import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SCANNER_WEIGHTS } from "../../../../src/common/constants/scoring.js";
import { Clock } from "../../../../src/infrastructure/clock.service.js";
import { ProcessExecutionError } from "../../../../src/infrastructure/process-execution.error.js";
import { ProcessRunner } from "../../../../src/infrastructure/process-runner.service.js";
import { ProcessStartError } from "../../../../src/infrastructure/process-start.error.js";
import { GitScanner } from "../../../../src/scanners/git/git.scanner.js";
import { ScannersModule } from "../../../../src/scanners/scanners.module.js";

import type { ProcessRequest } from "../../../../src/common/types/process-request.type.js";
import type { ProcessResult } from "../../../../src/common/types/process-result.type.js";
import type { ScanContext } from "../../../../src/common/types/scan-context.type.js";
import type { ScanResult } from "../../../../src/common/types/scan-result.type.js";
import type { ScanStatus } from "../../../../src/common/types/scan-status.type.js";
import type { Mock } from "vitest";

const context: ScanContext = {
  cwd: "/test-only/project", projectName: "project",
  packageJsonPath: "/test-only/project/package.json", packageJson: {}, ci: false,
};
const now = vi.fn<Clock["now"]>();
const clock = { now } as unknown as Clock;

type GitCommand = "rev-parse" | "branch" | "status";
const ok = (over: Partial<ProcessResult> = {}): ProcessResult =>
  ({ exitCode: 0, stdout: "", stderr: "", timedOut: false, ...over });

function dispatch(results: Partial<Record<GitCommand, ProcessResult>>): Mock {
  return vi.fn((request: ProcessRequest): Promise<ProcessResult> => {
    const value = results[request.args[0] as GitCommand];
    if (value === undefined) return Promise.reject(new Error(`test-only unexpected: ${request.args.join(" ")}`));
    return Promise.resolve(value);
  });
}

function build(run: Mock): GitScanner {
  return new GitScanner({ run } as unknown as ProcessRunner, clock);
}

const expected = (status: ScanStatus, summary: string, durationMs = 25): ScanResult =>
  ({ id: "git", name: "Git", status, summary, details: [], durationMs, weight: SCANNER_WEIGHTS.git });

beforeEach((): void => { now.mockReset(); now.mockReturnValueOnce(1000).mockReturnValue(1025); });
afterEach((): void => { vi.restoreAllMocks(); });

describe("GitScanner", (): void => {
  it.each([
    { label: "named branch", branch: "main\n", name: "main" },
    { label: "detached HEAD", branch: "", name: "detached HEAD" },
  ])("passes on a clean work tree with a $label", async ({ branch, name }): Promise<void> => {
    const run = dispatch({ "rev-parse": ok({ stdout: "true\n" }), branch: ok({ stdout: branch }), status: ok() });
    await expect(build(run).run(context)).resolves.toEqual(expected("passed", `Working tree is clean (${name})`));
  });

  it.each([
    { label: "staged change", porcelain: "A  src/a.ts\n", count: 1, leak: "src/a.ts" },
    { label: "unstaged change", porcelain: " M src/b.ts\n", count: 1, leak: "src/b.ts" },
    { label: "untracked file", porcelain: "?? src/c.ts\n", count: 1, leak: "src/c.ts" },
    { label: "multiple changes", porcelain: "A  a.ts\n M b.ts\n?? c.ts\n", count: 3, leak: "b.ts" },
  ])("fails and reports only a count for a $label", async ({ porcelain, count, leak }): Promise<void> => {
    const run = dispatch({ "rev-parse": ok({ stdout: "true\n" }), branch: ok({ stdout: "main\n" }), status: ok({ stdout: porcelain }) });
    const result = await build(run).run(context);
    expect(result).toEqual(expected("failed", `Working tree has ${count} changed files`));
    expect(result.summary).not.toContain(leak);
    expect(result.details).toEqual([]);
  });

  it("fails as not a repository and skips the later commands", async (): Promise<void> => {
    const run = dispatch({ "rev-parse": ok({ exitCode: 128, stderr: "fatal: not a git repository" }) });
    await expect(build(run).run(context)).resolves.toEqual(expected("failed", "Not a Git repository"));
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0].args).toEqual(["rev-parse", "--is-inside-work-tree"]);
  });

  it.each([
    ["a spawn failure", new ProcessStartError()],
    ["an adapter failure", new ProcessExecutionError("adapter")],
  ])("returns an error on %s", async (_label: string, cause: Error): Promise<void> => {
    const run = vi.fn().mockRejectedValue(cause);
    await expect(build(run).run(context)).resolves.toEqual(expected("error", "Scanner could not complete"));
  });

  it.each([
    { label: "rev-parse", results: { "rev-parse": ok({ exitCode: 1, timedOut: true }) } },
    {
      label: "status", results: {
        "rev-parse": ok({ stdout: "true\n" }), branch: ok({ stdout: "main\n" }), status: ok({ timedOut: true }),
      },
    },
  ])("returns an error when $label times out", async ({ results }): Promise<void> => {
    await expect(build(dispatch(results)).run(context)).resolves.toEqual(expected("error", "Scanner could not complete"));
  });

  it("records the elapsed duration measured by the clock", async (): Promise<void> => {
    now.mockReset(); now.mockReturnValueOnce(1000).mockReturnValue(1042);
    const run = dispatch({ "rev-parse": ok({ stdout: "true\n" }), branch: ok({ stdout: "main\n" }), status: ok() });
    expect((await build(run).run(context)).durationMs).toBe(42);
  });

  it("uses the scan cwd and a 10s timeout for every Git command", async (): Promise<void> => {
    const run = dispatch({ "rev-parse": ok({ stdout: "true\n" }), branch: ok({ stdout: "main\n" }), status: ok() });
    await build(run).run(context);
    for (const call of run.mock.calls) {
      expect(call[0]).toMatchObject({ file: "git", cwd: context.cwd, timeoutMs: 10_000 });
    }
  });
});

describe("GitScanner wiring", (): void => {
  it("resolves through ScannersModule with emitted constructor metadata", async (): Promise<void> => {
    const moduleRef = await Test.createTestingModule({ imports: [ScannersModule] }).compile();
    try {
      const scanner = moduleRef.get(GitScanner);
      expect(scanner).toBeInstanceOf(GitScanner);
      expect(scanner.id).toBe("git");
      expect(scanner.name).toBe("Git");
      expect(scanner.weight).toBe(SCANNER_WEIGHTS.git);
      expect(Reflect.getMetadata("design:paramtypes", GitScanner)).toEqual([ProcessRunner, Clock]);
    } finally {
      await moduleRef.close();
    }
  });
});
