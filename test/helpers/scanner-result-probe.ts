import "reflect-metadata";

import type { Scanner } from "../../src/common/contracts/scanner.contract.js";
import type { ScanResult } from "../../src/common/types/scan-result.type.js";
import type { ScanStatus } from "../../src/common/types/scan-status.type.js";
import type { ScannerId } from "../../src/common/types/scanner-id.type.js";

type ScannerClass = { prototype: Scanner };

// Import the same dist modules the CLI loads so the patched prototypes are the ones it injects.
async function scannerClass(path: string, name: string): Promise<ScannerClass> {
  const module = await import(new URL(`../../../dist/scanners/${path}`, import.meta.url).href) as
    Record<string, ScannerClass>;
  const target = module[name];
  if (target === undefined) throw new Error("Invalid scanner probe target");
  return target;
}

const { TerminalReporter }: typeof import("../../src/reporter/terminal-reporter.service.js") = await import(
  new URL("../../../dist/reporter/terminal-reporter.service.js", import.meta.url).href
);

const mode = process.env.SHIPCHECK_SCANNER_PROBE;
const exitAttempt = process.env.SHIPCHECK_SCANNER_EXIT;

const failed: Record<string, ScannerId[]> = { review: ["build"], "not-ready": ["build", "test"] };
const summaries: Record<ScannerId, Record<"passed" | "failed", string>> = {
  git: { passed: "Working tree is clean (main)", failed: "Working tree has uncommitted changes" },
  build: { passed: "npm run build passed", failed: "npm run build failed" },
  test: { passed: "npm test passed", failed: "npm test failed" },
  env: { passed: "2 required variables are present", failed: "Missing required variables" },
};

// Replace only run(): IDs, names, weights, registry order, orchestration, scoring,
// reporting, command and bootstrap all stay production code. Nothing is spawned.
for (const [path, name] of [
  ["git/git.scanner.js", "GitScanner"],
  ["build/build.scanner.js", "BuildScanner"],
  ["test/test.scanner.js", "TestScanner"],
  ["env/env.scanner.js", "EnvScanner"],
] as const) {
  const target = await scannerClass(path, name);
  target.prototype.run = async function (this: Scanner): Promise<ScanResult> {
    // A hostile scanner tries to decide the process exit itself.
    if (exitAttempt !== undefined) process.exitCode = Number(exitAttempt);
    if (mode === "throw" && this.id === "git") throw new Error("test-only-secret-scanner-throw");
    const status: ScanStatus = failed[mode ?? ""]?.includes(this.id) === true ? "failed" : "passed";
    return {
      id: this.id, name: this.name, status, summary: summaries[this.id][status],
      details: [], durationMs: 1, weight: this.weight,
    };
  };
}

if (mode === "report-fails") {
  TerminalReporter.prototype.report = async function (): Promise<void> {
    throw new Error("test-only-secret-report-failure");
  };
}
