import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

type CliResult = {
  stdout: string;
  stderr: string;
  exitCode: number | undefined;
};

const entry = resolve("dist/main.js");
const manifest: unknown = JSON.parse(await readFile("package.json", "utf8"));
if (typeof manifest !== "object" || manifest === null || !("version" in manifest) ||
  typeof manifest.version !== "string") {
  throw new Error("Test requires the package version");
}
const version = manifest.version;
const usageError = "Shipcheck received invalid arguments. Run shipcheck --help for usage.\n";
const fatalError = "Shipcheck could not complete the command.\n";
const cleanup = "probe:destroyed\nprobe:shutdown\n";

async function runCli(
  args: string[],
  cwd: string = process.cwd(),
  probe?: string,
): Promise<CliResult> {
  const preload = ["--import", new URL("../helpers/reject-network-listen.js", import.meta.url).href];
  if (probe !== undefined) {
    preload.push("--import", new URL("../helpers/bootstrap-probe.js", import.meta.url).href);
  }
  const result = await execa(process.execPath, [...preload, entry, ...args], {
    cwd,
    env: { NO_COLOR: "1", SHIPCHECK_TEST_PROBE: probe },
    timeout: 10_000,
    maxBuffer: 1_000_000,
    stripFinalNewline: false,
    reject: false,
  });

  expect(result.timedOut).toBe(false);
  expect(result.stdout + result.stderr).not.toMatch(/\u001b|\r|\[Nest\]|test-only-secret/);
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
}

describe("compiled CLI bootstrap", (): void => {
  it.each([{ args: [] }, { args: ["--help"] }, { args: ["-h"] }])("prints product help for $args", async ({ args }): Promise<void> => {
    const result = await runCli(args);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "Usage: shipcheck [options]\n\n" +
      "Check whether a Node.js project is ready to ship\n\n" +
      "Options:\n" +
      "  -V, --version  output the version number\n" +
      "  -h, --help     display help for command\n",
    );
  }, 15_000);

  it.each(["--version", "-V"])("prints only the package version for %s", async (flag: string): Promise<void> => {
    const result = await runCli([flag]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`${version}\n`);
    expect(result.stderr).toBe("");
  }, 15_000);

  it.each(["--unknown", "scan", "help", "./project", "--ci"])(
    "rejects unsupported usage %s",
    async (arg: string): Promise<void> => {
      const result = await runCli([arg]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(usageError);
    }, 15_000,
  );

  it("loads its own version and ignores project/plugin metadata without modifying the directory", async (): Promise<void> => {
    const directory = await mkdtemp(join(tmpdir(), "shipcheck-bootstrap-"));
    try {
      const emptyResult = await runCli(["--version"], directory);
      expect(emptyResult.exitCode).toBe(0);
      expect(emptyResult.stdout).toBe(`${version}\n`);
      expect(emptyResult.stderr).toBe("");
      expect(await readdir(directory)).toEqual([]);

      await writeFile(join(directory, "package.json"), '{"version":"99.99.99"}', "utf8");
      await writeFile(join(directory, ".shipcheckrc.json"), "invalid plugin configuration", "utf8");
      const files = await readdir(directory);
      const versionResult = await runCli(["--version"], directory);
      const helpResult = await runCli(["--help"], directory);

      expect(versionResult.exitCode).toBe(0);
      expect(versionResult.stdout).toBe(`${version}\n`);
      expect(versionResult.stderr).toBe("");
      expect(helpResult.exitCode).toBe(0);
      expect(helpResult.stdout).toContain("Usage: shipcheck [options]");
      expect(helpResult.stderr).toBe("");
      expect(await readdir(directory)).toEqual(files);
      expect(await readFile(join(directory, "package.json"), "utf8")).toBe('{"version":"99.99.99"}');
      expect(await readFile(join(directory, ".shipcheckrc.json"), "utf8")).toBe("invalid plugin configuration");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);

  it.each([
    { args: [], code: 0, diagnostic: "" },
    { args: ["--help"], code: 0, diagnostic: "" },
    { args: ["--version"], code: 0, diagnostic: "" },
    { args: ["--unknown"], code: 2, diagnostic: usageError },
    { args: ["unexpected"], code: 2, diagnostic: usageError },
  ])("finishes asynchronous shutdown for $args", async ({ args, code, diagnostic }): Promise<void> => {
    const result = await runCli(args, process.cwd(), "lifecycle");

    expect(result.exitCode).toBe(code);
    expect(result.stderr).toBe(diagnostic + cleanup);
  }, 15_000);

  it.each(["execution", "lookalike"])("closes the application after %s failure", async (probe: string): Promise<void> => {
    const result = await runCli([], process.cwd(), probe);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(cleanup + fatalError);
  }, 15_000);

  it("reports startup failure without a framework log or stack", async (): Promise<void> => {
    const result = await runCli(["--help"], process.cwd(), "startup");

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(fatalError);
  }, 15_000);

  it("reports cleanup failure even after version succeeds", async (): Promise<void> => {
    const result = await runCli(["--version"], process.cwd(), "cleanup");

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe(`${version}\n`);
    expect(result.stderr).toBe(cleanup + fatalError);
  }, 15_000);
});
