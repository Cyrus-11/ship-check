import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

type CliResult = { stdout: string; stderr: string; exitCode: number | undefined };
type ProbeOptions = {
  scan?: string; lifecycle?: string; cwd?: string; ci?: string; scanners?: string; scannerExit?: string;
};

const entry = resolve("dist/main.js");
const usageError = "Shipcheck received invalid arguments. Run shipcheck --help for usage.\n";
const fatalError = "Shipcheck could not complete the command.\n";
const nextStep = "Run the command from the root of a Node.js project.\n";
const notFound = "Shipcheck could not scan this directory: package.json was not found.\n" + nextStep;
const invalidJson = "Shipcheck could not scan this directory: package.json is not valid JSON.\n" + nextStep;
const cleanup = "probe:destroyed\nprobe:shutdown\n";
const scanHelp = "Usage: shipcheck scan [options]\n\n" +
  "Run release-readiness checks\n\nOptions:\n" +
  "  --ci        Enforce the release gate through process exit codes\n" +
  "  -h, --help  display help for command\n";
const minimalManifest = '{ "name": "test-only-project" }';

// No-script projects never execute repository code; Git reports a non-repository.
async function minimalReport(directory: string): Promise<string> {
  const { version } = JSON.parse(await readFile("package.json", "utf8")) as { version: string };
  return `Shipcheck v${version}\n\nProject: test-only-project\nPath: ${await realpath(directory)}\n\n` +
    "✗ Git          Not a Git repository\n" +
    "✗ Build        package.json has no build script\n" +
    "✗ Tests        package.json has no test script\n" +
    "○ Environment  No .env.example found\n\n" +
    "Checks: 0 passed, 3 failed, 1 skipped\nRelease score: 0/100\nStatus: NOT READY\nRelease gate: FAILED\n";
}

type ControlledScan = { rows: string; checks: string; score: number; status: string; gate: string };

const passedRows = {
  git: "✓ Git          Working tree is clean (main)\n",
  build: "✓ Build        npm run build passed\n",
  test: "✓ Tests        npm test passed\n",
  env: "✓ Environment  2 required variables are present\n",
};
const controlledScans: Record<string, ControlledScan> = {
  ready: {
    rows: passedRows.git + passedRows.build + passedRows.test + passedRows.env,
    checks: "4 passed, 0 failed, 0 skipped", score: 100, status: "READY", gate: "PASSED",
  },
  review: {
    rows: passedRows.git + "✗ Build        npm run build failed\n" + passedRows.test + passedRows.env,
    checks: "3 passed, 1 failed, 0 skipped", score: 75, status: "REVIEW", gate: "FAILED",
  },
  "not-ready": {
    rows: passedRows.git + "✗ Build        npm run build failed\n" + "✗ Tests        npm test failed\n" + passedRows.env,
    checks: "2 passed, 2 failed, 0 skipped", score: 50, status: "NOT READY", gate: "FAILED",
  },
  throw: {
    rows: "! Git          Scanner could not complete\n" + passedRows.build + passedRows.test + passedRows.env,
    checks: "3 passed, 1 failed, 0 skipped", score: 75, status: "REVIEW", gate: "FAILED",
  },
};

// Rendered by the production scoring/reporter path from the scanner-result probe's rows.
async function controlledReport(directory: string, mode: string): Promise<string> {
  const scan = controlledScans[mode];
  if (scan === undefined) throw new Error("Unknown controlled scan");
  const { version } = JSON.parse(await readFile("package.json", "utf8")) as { version: string };
  return `Shipcheck v${version}\n\nProject: test-only-project\nPath: ${await realpath(directory)}\n\n` +
    `${scan.rows}\nChecks: ${scan.checks}\nRelease score: ${scan.score}/100\n` +
    `Status: ${scan.status}\nRelease gate: ${scan.gate}\n`;
}

// Never run an unprobed scan from this repository: it would execute Shipcheck's own tests.
async function withMinimalProject(use: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "shipcheck-scan-"));
  try {
    await writeFile(join(directory, "package.json"), minimalManifest, "utf8");
    await use(directory);
    expect(await readdir(directory)).toEqual(["package.json"]);
    expect(await readFile(join(directory, "package.json"), "utf8")).toBe(minimalManifest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function runCli(args: string[], options: ProbeOptions = {}): Promise<CliResult> {
  const preload = ["--import", new URL("../helpers/reject-network-listen.js", import.meta.url).href];
  if (options.scan !== undefined) {
    preload.push("--import", new URL("../helpers/scan-probe.js", import.meta.url).href);
  }
  if (options.lifecycle !== undefined) {
    preload.push("--import", new URL("../helpers/bootstrap-probe.js", import.meta.url).href);
  }
  if (options.scanners !== undefined) {
    preload.push("--import", new URL("../helpers/scanner-result-probe.js", import.meta.url).href);
  }
  const result = await execa(process.execPath, [...preload, entry, ...args], {
    cwd: options.cwd ?? process.cwd(),
    env: {
      NO_COLOR: "1",
      CI: options.ci,
      SHIPCHECK_SCAN_PROBE: options.scan,
      SHIPCHECK_TEST_PROBE: options.lifecycle,
      SHIPCHECK_SCANNER_PROBE: options.scanners,
      SHIPCHECK_SCANNER_EXIT: options.scannerExit,
      // Keep an enclosing repository or inherited Git location from changing the Git check.
      GIT_CEILING_DIRECTORIES: dirname(await realpath(options.cwd ?? process.cwd())),
      GIT_DIR: undefined,
      GIT_WORK_TREE: undefined,
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

describe("compiled scan command", (): void => {
  it.each([
    { args: ["scan"], code: 0 },
    { args: ["scan", "--ci"], code: 1 },
  ])("scans a minimal project, reports once, and exits $code for $args", async ({ args, code }): Promise<void> => {
    await withMinimalProject(async (directory): Promise<void> => {
      expect(await runCli(args, { cwd: directory })).toEqual({
        stdout: await minimalReport(directory), stderr: "", exitCode: code,
      });
    });
  }, 30_000);

  it.each([
    { mode: "ready", args: ["scan"], code: 0 },
    { mode: "ready", args: ["scan", "--ci"], code: 0 },
    { mode: "review", args: ["scan"], code: 0 },
    { mode: "review", args: ["scan", "--ci"], code: 1 },
    { mode: "not-ready", args: ["scan"], code: 0 },
    { mode: "not-ready", args: ["scan", "--ci"], code: 1 },
    // A scanner exception is a scored result, never a fatal exit.
    { mode: "throw", args: ["scan"], code: 0 },
    { mode: "throw", args: ["scan", "--ci"], code: 1 },
  ])("renders the real $mode report and exits $code for $args", async ({ mode, args, code }): Promise<void> => {
    await withMinimalProject(async (directory): Promise<void> => {
      expect(await runCli(args, { cwd: directory, scanners: mode })).toEqual({
        stdout: await controlledReport(directory, mode), stderr: "", exitCode: code,
      });
    });
  }, 30_000);

  it.each([
    { mode: "review", args: ["scan"], attempt: "2", code: 0 },
    { mode: "review", args: ["scan", "--ci"], attempt: "0", code: 1 },
    { mode: "ready", args: ["scan", "--ci"], attempt: "1", code: 0 },
  ])("ignores a $mode scanner that assigns exit $attempt for $args", async ({ mode, args, attempt, code }): Promise<void> => {
    await withMinimalProject(async (directory): Promise<void> => {
      expect(await runCli(args, { cwd: directory, scanners: mode, scannerExit: attempt })).toEqual({
        stdout: await controlledReport(directory, mode), stderr: "", exitCode: code,
      });
    });
  }, 30_000);

  it.each([{ args: ["scan"] }, { args: ["scan", "--ci"] }])(
    "selects no gate exit when the report cannot render for $args", async ({ args }): Promise<void> => {
      await withMinimalProject(async (directory): Promise<void> => {
        expect(await runCli(args, { cwd: directory, scanners: "report-fails" })).toEqual({
          stdout: "", stderr: fatalError, exitCode: 2,
        });
      });
    }, 30_000,
  );

  it("completes both the report and application cleanup with the CI gate exit", async (): Promise<void> => {
    await withMinimalProject(async (directory): Promise<void> => {
      expect(await runCli(["scan", "--ci"], { cwd: directory, lifecycle: "lifecycle" })).toEqual({
        stdout: await minimalReport(directory), stderr: cleanup, exitCode: 1,
      });
    });
  }, 30_000);

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
    { args: ["scan"], report: true },
    { args: ["scan", "--ci"], report: true },
    { args: ["scan", "--help"], report: false },
  ])("cleanup failure overrides the result of $args", async ({ args, report }): Promise<void> => {
    await withMinimalProject(async (directory): Promise<void> => {
      expect(await runCli(args, { cwd: directory, lifecycle: "cleanup" })).toEqual({
        stdout: report ? await minimalReport(directory) : scanHelp, stderr: cleanup + fatalError, exitCode: 2,
      });
    });
  }, 30_000);

  it("reports a missing package.json as a fatal discovery error and mutates nothing", async (): Promise<void> => {
    const directory = await mkdtemp(join(tmpdir(), "shipcheck-discovery-"));
    try {
      expect(await runCli(["scan"], { cwd: directory })).toEqual({ stdout: "", stderr: notFound, exitCode: 2 });
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);

  it("reports invalid package.json without leaking or changing its contents", async (): Promise<void> => {
    const directory = await mkdtemp(join(tmpdir(), "shipcheck-discovery-"));
    try {
      const manifest = "invalid project JSON: test-only-secret-manifest";
      await writeFile(join(directory, "package.json"), manifest, "utf8");
      expect(await runCli(["scan", "--ci"], { cwd: directory })).toEqual({ stdout: "", stderr: invalidJson, exitCode: 2 });
      expect(await readdir(directory)).toEqual(["package.json"]);
      expect(await readFile(join(directory, "package.json"), "utf8")).toBe(manifest);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);

  it("shows scan help from a valid project without scanning it", async (): Promise<void> => {
    await withMinimalProject(async (directory): Promise<void> => {
      expect(await runCli(["scan", "--help"], { cwd: directory })).toEqual({ stdout: scanHelp, stderr: "", exitCode: 0 });
    });
  }, 30_000);
});
