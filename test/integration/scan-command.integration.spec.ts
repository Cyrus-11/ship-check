import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

type CliResult = { stdout: string; stderr: string; exitCode: number | undefined };
type ProbeOptions = { scan?: string; lifecycle?: string; cwd?: string; ci?: string };

const entry = resolve("dist/main.js");
const usageError = "Shipcheck received invalid arguments. Run shipcheck --help for usage.\n";
const fatalError = "Shipcheck could not complete the command.\n";
const cleanup = "probe:destroyed\nprobe:shutdown\n";
const scanHelp = "Usage: shipcheck scan [options]\n\n" +
  "Run release-readiness checks\n\nOptions:\n" +
  "  --ci        Enforce the release gate through process exit codes\n" +
  "  -h, --help  display help for command\n";

async function runCli(args: string[], options: ProbeOptions = {}): Promise<CliResult> {
  const preload = ["--import", new URL("../helpers/reject-network-listen.js", import.meta.url).href];
  if (options.scan !== undefined) {
    preload.push("--import", new URL("../helpers/scan-probe.js", import.meta.url).href);
  }
  if (options.lifecycle !== undefined) {
    preload.push("--import", new URL("../helpers/bootstrap-probe.js", import.meta.url).href);
  }
  const result = await execa(process.execPath, [...preload, entry, ...args], {
    cwd: options.cwd ?? process.cwd(),
    env: {
      NO_COLOR: "1",
      CI: options.ci,
      SHIPCHECK_SCAN_PROBE: options.scan,
      SHIPCHECK_TEST_PROBE: options.lifecycle,
    },
    timeout: 10_000,
    maxBuffer: 1_000_000,
    stripFinalNewline: false,
    reject: false,
  });
  expect(result.timedOut).toBe(false);
  expect(result.stdout + result.stderr).not.toMatch(/\u001b|\r|\[Nest\]|test-only-secret/);
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
}

describe("compiled scan command shell", (): void => {
  it.each([
    { args: ["scan"], code: 0 },
    { args: ["scan", "--ci"], code: 1 },
  ])("runs the temporary shell for $args", async ({ args, code }): Promise<void> => {
    expect(await runCli(args)).toEqual({ stdout: "", stderr: "", exitCode: code });
  }, 15_000);

  it.each([
    { args: ["scan"], ci: false, mode: "observe", code: 0 },
    { args: ["scan", "--ci"], ci: true, mode: "observe", code: 1 },
    { args: ["scan"], ci: false, mode: "ready", code: 0 },
    { args: ["scan", "--ci"], ci: true, mode: "ready", code: 0 },
  ])("forwards ci=$ci with $mode result and preserves exit $code after cleanup", async ({ args, ci, mode, code }): Promise<void> => {
    const result = await runCli(args, { scan: mode, lifecycle: "lifecycle" });
    expect(result).toEqual({
      stdout: "", stderr: `probe:scan:${JSON.stringify({ ci })}\n` + cleanup, exitCode: code,
    });
  }, 15_000);

  it("does not enable CI mode from the ambient environment", async (): Promise<void> => {
    expect(await runCli(["scan"], { scan: "observe", ci: "true" })).toEqual({
      stdout: "", stderr: 'probe:scan:{"ci":false}\n', exitCode: 0,
    });
  }, 15_000);

  it.each(["--help", "-h"])("shows scan %s without invoking the service and finishes cleanup", async (flag: string): Promise<void> => {
    expect(await runCli(["scan", flag], { scan: "observe", lifecycle: "lifecycle" })).toEqual({
      stdout: scanHelp, stderr: cleanup, exitCode: 0,
    });
  }, 15_000);

  it.each([{ args: [] }, { args: ["--help"] }, { args: ["--version"] }])(
    "does not invoke scans for root $args", async ({ args }): Promise<void> => {
      const result = await runCli(args, { scan: "observe" });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.length).toBeGreaterThan(0);
    }, 15_000,
  );

  it.each([
    { args: ["scan", "--unknown"] },
    { args: ["scan", "./project"] },
    { args: ["scan", "--", "./project"] },
    { args: ["scan", "--ci=false"] },
    { args: ["scan", "--ci", "true"] },
    { args: ["scan", "--no-ci"] },
    { args: ["scan", "--unknown=test-only-secret-argument"] },
  ])("rejects $args before scanning and finishes cleanup", async ({ args }): Promise<void> => {
    expect(await runCli(args, { scan: "observe", lifecycle: "lifecycle" })).toEqual({
      stdout: "", stderr: usageError + cleanup, exitCode: 2,
    });
  }, 15_000);

  it.each(["reject", "lookalike"])("safely handles a %s service failure after cleanup", async (mode: string): Promise<void> => {
    expect(await runCli(["scan", "--ci"], { scan: mode, lifecycle: "lifecycle" })).toEqual({
      stdout: "", stderr: 'probe:scan:{"ci":true}\n' + cleanup + fatalError, exitCode: 2,
    });
  }, 15_000);

  it.each([
    { args: ["scan"], stdout: "" },
    { args: ["scan", "--ci"], stdout: "" },
    { args: ["scan", "--help"], stdout: scanHelp },
  ])("cleanup failure overrides the result of $args", async ({ args, stdout }): Promise<void> => {
    expect(await runCli(args, { lifecycle: "cleanup" })).toEqual({
      stdout, stderr: cleanup + fatalError, exitCode: 2,
    });
  }, 15_000);

  it("performs no discovery or target mutation in an unrelated directory", async (): Promise<void> => {
    const directory = await mkdtemp(join(tmpdir(), "shipcheck-scan-shell-"));
    try {
      expect(await runCli(["scan"], { cwd: directory })).toEqual({ stdout: "", stderr: "", exitCode: 0 });
      expect(await readdir(directory)).toEqual([]);

      const manifest = "invalid project JSON: test-only-secret-manifest";
      await writeFile(join(directory, "package.json"), manifest, "utf8");
      expect(await runCli(["scan", "--ci"], { cwd: directory })).toEqual({ stdout: "", stderr: "", exitCode: 1 });
      expect(await runCli(["scan", "--help"], { cwd: directory })).toEqual({ stdout: scanHelp, stderr: "", exitCode: 0 });
      expect(await readdir(directory)).toEqual(["package.json"]);
      expect(await readFile(join(directory, "package.json"), "utf8")).toBe(manifest);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);
});
