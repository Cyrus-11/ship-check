import "reflect-metadata";

import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FileSystem } from "../../src/infrastructure/file-system.service.js";
import { ProcessRunner } from "../../src/infrastructure/process-runner.service.js";
import { ProcessStartError } from "../../src/infrastructure/process-start.error.js";

const fs = new FileSystem();
const runner = new ProcessRunner(fs);
let directory: string;
let npmEnv: NodeJS.ProcessEnv;

beforeAll(async (): Promise<void> => {
  directory = await mkdtemp(join(tmpdir(), "shipcheck adapter "));
  npmEnv = {
    CI: "true", npm_config_loglevel: "silent", npm_config_ignore_scripts: "false",
    npm_config_update_notifier: "false", npm_config_audit: "false", npm_config_fund: "false",
    npm_config_userconfig: join(directory, "user.npmrc"),
    npm_config_globalconfig: join(directory, "global.npmrc"),
    npm_config_cache: join(directory, "cache"),
  };
  await writeFile(join(directory, "user.npmrc"), "");
  await writeFile(join(directory, "global.npmrc"), "");
  await writeFile(join(directory, "package.json"), JSON.stringify({
    name: "test-only-adapter", version: "1.0.0", private: true,
    scripts: { build: "node build.cjs", test: "node test.cjs", tree: "node tree.cjs" },
  }));
  await writeFile(join(directory, "build.cjs"), "process.stdout.write('test-only build');");
  await writeFile(join(directory, "test.cjs"), "process.stdout.write(process.env.CI === 'true' ? 'test-only CI received' : 'missing CI'); process.exitCode = 7;");
  await writeFile(join(directory, "tree.cjs"), [
    "const {spawn} = require('node:child_process');",
    "const {writeFileSync} = require('node:fs');",
    "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'ignore', windowsHide: true});",
    "writeFileSync('child-pid.json', JSON.stringify([child.pid, process.pid]));",
    "setInterval(() => {}, 1000);",
  ].join("\n"));
});

afterAll(async (): Promise<void> => { if (directory !== undefined) await rm(directory, { recursive: true, force: true }); });

async function node(args: string[], timeoutMs = 5_000): ReturnType<ProcessRunner["run"]> {
  return runner.run({ file: process.execPath, args, cwd: directory, timeoutMs });
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") return false;
    throw error;
  }
}

describe("native infrastructure adapters", (): void => {
  it.each([0, 7])("captures both streams with exit %i", async (code): Promise<void> => {
    const result = await node(["-e", `process.stdout.write('café 🌱\\n'); process.stderr.write('test-only stderr\\n'); process.exitCode = ${code};`]);
    expect(result).toEqual({ exitCode: code, stdout: "café 🌱\n", stderr: "test-only stderr\n", timedOut: false });
  });

  it("preserves literal argument values and closes stdin", async (): Promise<void> => {
    const args = ["spaces here", "& echo test-only", "$(test-only)", "%PATH%", "a|b", 'a"b', "trailing\\", "line\nbreak"];
    const result = await node(["-e", "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write(JSON.stringify(process.argv.slice(1))));", "--", ...args]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual(args);
  });

  it("reports unavailable commands and missing cwd as start failures", async (): Promise<void> => {
    await expect(runner.run({ file: "shipcheck-test-only-missing-7d82.exe", args: [], cwd: directory, timeoutMs: 1_000 })).rejects.toThrow(ProcessStartError);
    await expect(runner.run({ file: process.execPath, args: [], cwd: join(directory, "missing"), timeoutMs: 1_000 })).rejects.toThrow(ProcessStartError);
  });

  it("returns a timeout result after terminating a controlled child", async (): Promise<void> => {
    const result = await node(["-e", "setInterval(() => {}, 1000)"], 200);
    expect(result).toEqual({ exitCode: 1, stdout: "", stderr: "", timedOut: true });
  }, 10_000);

  it.each(["stdout", "stderr"])("treats excessive Unicode %s as an operational error", async (stream): Promise<void> => {
    await expect(node(["-e", `process.${stream}.write('🌱'.repeat(300001));`])).rejects.toMatchObject({
      name: "ProcessExecutionError", reason: "output_limit", message: "Unable to complete the requested process.",
    });
  });

  it("runs npm build and test from a directory with spaces and forwards CI", async (): Promise<void> => {
    const beforeEnv = { ...process.env };
    const build = await runner.run({ file: "npm", args: ["run", "build"], cwd: directory, env: npmEnv, timeoutMs: 10_000 });
    expect(build).toEqual({ exitCode: 0, stdout: "test-only build", stderr: "", timedOut: false });
    const test = await runner.run({ file: "npm", args: ["test"], cwd: directory, env: npmEnv, timeoutMs: 10_000 });
    expect(test).toEqual({ exitCode: 7, stdout: "test-only CI received", stderr: "", timedOut: false });
    expect(process.env).toEqual(beforeEnv);
  }, 25_000);

  it("terminates the controlled npm script descendant on timeout", async (): Promise<void> => {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        // Match the npm smoke test's startup allowance. Under the full parallel
        // suite, a two-second budget can expire before the fixture even starts.
        runner.run({ file: "npm", args: ["run", "tree"], cwd: directory, env: npmEnv, timeoutMs: 10_000 }),
        new Promise<never>((_resolve, reject): void => {
          deadline = setTimeout((): void => { reject(new Error("Fixture process tree did not settle")); }, 18_000);
        }),
      ]);
      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(1);
      const pids = await fixturePids();
      expect(pids).toHaveLength(2);
      for (const pid of pids) {
        for (let attempt = 0; attempt < 20 && alive(pid); attempt++) await delay(50);
        expect(alive(pid)).toBe(false);
      }
    } finally {
      clearTimeout(deadline);
      // Read IDs even if the adapter never settles. Cleanup cannot depend on a
      // successful await of the behavior under test, especially in a sandbox.
      for (const pid of await fixturePids()) {
        try {
          process.kill(pid, "SIGKILL");
        } catch (error: unknown) {
          if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
        }
      }
    }
  }, 25_000);

  it("reads real UTF-8 files without changing the project", async (): Promise<void> => {
    const path = join(directory, "build.cjs");
    const files = await readdir(directory);
    const text = await readFile(path, "utf8");
    expect(await fs.readText(path)).toBe(text);
    expect(await fs.exists(path)).toBe(true);
    expect(await fs.exists(join(directory, "missing"))).toBe(false);
    expect(await readFile(path, "utf8")).toBe(text);
    expect(await readdir(directory)).toEqual(files);
  });

  it("resolves Windows filenames case-insensitively on the actual filesystem", async (): Promise<void> => {
    if (process.platform !== "win32") return;
    await writeFile(join(directory, "TestOnly.EXE"), "test-only lookup fixture, never executed");
    expect(await fs.resolveWindowsExecutable("testonly", directory, { PATHEXT: ".exe" })).toBe(join(directory, "testonly.exe"));
  });

  it("runs production providers through real Nest DI without terminal or network noise", async (): Promise<void> => {
    const result = await execa(process.execPath, [
      "--import", new URL("../helpers/reject-network-listen.js", import.meta.url).href,
      fileURLToPath(new URL("../helpers/infrastructure-probe.js", import.meta.url)),
    ], { cwd: resolve("."), timeout: 10_000, reject: false });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({ exitCode: 0, stdout: "production adapter", stderr: "", timedOut: false });
  }, 15_000);
});

async function fixturePids(): Promise<number[]> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(join(directory, "child-pid.json"), "utf8"));
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  if (!Array.isArray(value) || !value.every((pid: unknown): pid is number =>
    typeof pid === "number" && Number.isInteger(pid) && pid > 0)) {
    throw new Error("Invalid test-owned child IDs");
  }
  return value;
}
