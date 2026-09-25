import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SCANNER_WEIGHTS } from "../../../../src/common/constants/scoring.js";
import { Clock } from "../../../../src/infrastructure/clock.service.js";
import { ProcessExecutionError } from "../../../../src/infrastructure/process-execution.error.js";
import { ProcessRunner } from "../../../../src/infrastructure/process-runner.service.js";
import { ProcessStartError } from "../../../../src/infrastructure/process-start.error.js";
import { ScannersModule } from "../../../../src/scanners/scanners.module.js";
import { TestScanner } from "../../../../src/scanners/test/test.scanner.js";

import type { PackageJson } from "../../../../src/common/types/package-json.type.js";
import type { ProcessResult } from "../../../../src/common/types/process-result.type.js";
import type { ScanContext } from "../../../../src/common/types/scan-context.type.js";
import type { ScanResult } from "../../../../src/common/types/scan-result.type.js";
import type { ScanStatus } from "../../../../src/common/types/scan-status.type.js";
import type { Mock } from "vitest";

const now = vi.fn<Clock["now"]>();
const clock = { now } as unknown as Clock;

const contextWith = (packageJson: PackageJson): ScanContext => ({
  cwd: "/test-only/project", projectName: "project",
  packageJsonPath: "/test-only/project/package.json", packageJson, ci: false,
});
const withTest: ScanContext = contextWith({ scripts: { test: "vitest run" } });

const ok = (over: Partial<ProcessResult> = {}): ProcessResult =>
  ({ exitCode: 0, stdout: "", stderr: "", timedOut: false, ...over });

function test(run: Mock): TestScanner {
  return new TestScanner({ run } as unknown as ProcessRunner, clock);
}

const expected = (status: ScanStatus, summary: string, durationMs = 25): ScanResult =>
  ({ id: "test", name: "Tests", status, summary, details: [], durationMs, weight: SCANNER_WEIGHTS.test });

beforeEach((): void => { now.mockReset(); now.mockReturnValueOnce(1000).mockReturnValue(1025); });
afterEach((): void => { vi.restoreAllMocks(); });

describe("TestScanner", (): void => {
  it("passes when the test script exists and npm exits zero", async (): Promise<void> => {
    const run = vi.fn().mockResolvedValue(ok());
    await expect(test(run).run(withTest)).resolves.toEqual(expected("passed", "npm test passed"));
  });

  it.each([
    { label: "missing", packageJson: {} as PackageJson },
    { label: "blank", packageJson: { scripts: { test: "   " } } as PackageJson },
  ])("fails without spawning npm when the test script is $label", async ({ packageJson }): Promise<void> => {
    const run = vi.fn();
    await expect(test(run).run(contextWith(packageJson)))
      .resolves.toEqual(expected("failed", "package.json has no test script"));
    expect(run).not.toHaveBeenCalled();
  });

  it("fails when the test command exits non-zero", async (): Promise<void> => {
    const run = vi.fn().mockResolvedValue(ok({ exitCode: 1, stdout: "test-only test failure" }));
    const result = await test(run).run(withTest);
    expect(result).toEqual(expected("failed", "npm test failed"));
    expect(result.summary).not.toContain("test-only test failure");
  });

  it("fails with the canonical timeout message when the tests time out", async (): Promise<void> => {
    const run = vi.fn().mockResolvedValue(ok({ exitCode: 1, timedOut: true }));
    await expect(test(run).run(withTest))
      .resolves.toEqual(expected("failed", "npm test timed out after 120s"));
  });

  it.each([
    ["npm executable unavailable", new ProcessStartError()],
    ["an adapter failure", new ProcessExecutionError("adapter")],
  ])("returns an error on %s", async (_label: string, cause: Error): Promise<void> => {
    const run = vi.fn().mockRejectedValue(cause);
    await expect(test(run).run(withTest)).resolves.toEqual(expected("error", "Scanner could not complete"));
  });

  it("fails when the test output exceeds the capture limit", async (): Promise<void> => {
    const run = vi.fn().mockRejectedValue(new ProcessExecutionError("output_limit"));
    await expect(test(run).run(withTest)).resolves.toEqual(expected("failed", "npm test failed"));
  });

  it("uses the scan cwd, adds CI=true, and runs npm test without a shell", async (): Promise<void> => {
    const ciBefore = process.env.CI;
    const run = vi.fn().mockResolvedValue(ok());
    await test(run).run(withTest);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0]).toMatchObject({
      file: "npm", args: ["test"], cwd: withTest.cwd, env: { CI: "true" }, timeoutMs: 120_000,
    });
    expect(process.env.CI).toBe(ciBefore);
  });

  it("records the elapsed duration measured by the clock", async (): Promise<void> => {
    now.mockReset(); now.mockReturnValueOnce(1000).mockReturnValue(1042);
    const run = vi.fn().mockResolvedValue(ok());
    expect((await test(run).run(withTest)).durationMs).toBe(42);
  });
});

describe("TestScanner wiring", (): void => {
  it("resolves through ScannersModule with emitted constructor metadata", async (): Promise<void> => {
    const moduleRef = await Test.createTestingModule({ imports: [ScannersModule] }).compile();
    try {
      const scanner = moduleRef.get(TestScanner);
      expect(scanner).toBeInstanceOf(TestScanner);
      expect(scanner.id).toBe("test");
      expect(scanner.name).toBe("Tests");
      expect(scanner.weight).toBe(SCANNER_WEIGHTS.test);
      expect(Reflect.getMetadata("design:paramtypes", TestScanner)).toEqual([ProcessRunner, Clock]);
    } finally {
      await moduleRef.close();
    }
  });
});
