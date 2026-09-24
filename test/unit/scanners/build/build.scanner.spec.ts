import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SCANNER_WEIGHTS } from "../../../../src/common/constants/scoring.js";
import { Clock } from "../../../../src/infrastructure/clock.service.js";
import { ProcessExecutionError } from "../../../../src/infrastructure/process-execution.error.js";
import { ProcessRunner } from "../../../../src/infrastructure/process-runner.service.js";
import { ProcessStartError } from "../../../../src/infrastructure/process-start.error.js";
import { BuildScanner } from "../../../../src/scanners/build/build.scanner.js";
import { ScannersModule } from "../../../../src/scanners/scanners.module.js";

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
const withBuild: ScanContext = contextWith({ scripts: { build: "tsc -p ." } });

const ok = (over: Partial<ProcessResult> = {}): ProcessResult =>
  ({ exitCode: 0, stdout: "", stderr: "", timedOut: false, ...over });

function build(run: Mock): BuildScanner {
  return new BuildScanner({ run } as unknown as ProcessRunner, clock);
}

const expected = (status: ScanStatus, summary: string, durationMs = 25): ScanResult =>
  ({ id: "build", name: "Build", status, summary, details: [], durationMs, weight: SCANNER_WEIGHTS.build });

beforeEach((): void => { now.mockReset(); now.mockReturnValueOnce(1000).mockReturnValue(1025); });
afterEach((): void => { vi.restoreAllMocks(); });

describe("BuildScanner", (): void => {
  it("passes when the build script exists and npm exits zero", async (): Promise<void> => {
    const run = vi.fn().mockResolvedValue(ok());
    await expect(build(run).run(withBuild)).resolves.toEqual(expected("passed", "npm run build passed"));
  });

  it.each([
    { label: "missing", packageJson: {} as PackageJson },
    { label: "blank", packageJson: { scripts: { build: "   " } } as PackageJson },
  ])("fails without spawning npm when the build script is $label", async ({ packageJson }): Promise<void> => {
    const run = vi.fn();
    await expect(build(run).run(contextWith(packageJson)))
      .resolves.toEqual(expected("failed", "package.json has no build script"));
    expect(run).not.toHaveBeenCalled();
  });

  it("fails when the build command exits non-zero", async (): Promise<void> => {
    const run = vi.fn().mockResolvedValue(ok({ exitCode: 1, stdout: "test-only build error" }));
    const result = await build(run).run(withBuild);
    expect(result).toEqual(expected("failed", "npm run build failed"));
    expect(result.summary).not.toContain("test-only build error");
  });

  it("fails with the canonical timeout message when the build times out", async (): Promise<void> => {
    const run = vi.fn().mockResolvedValue(ok({ exitCode: 1, timedOut: true }));
    await expect(build(run).run(withBuild))
      .resolves.toEqual(expected("failed", "npm run build timed out after 120s"));
  });

  it.each([
    ["npm executable unavailable", new ProcessStartError()],
    ["an adapter failure", new ProcessExecutionError("adapter")],
  ])("returns an error on %s", async (_label: string, cause: Error): Promise<void> => {
    const run = vi.fn().mockRejectedValue(cause);
    await expect(build(run).run(withBuild)).resolves.toEqual(expected("error", "Scanner could not complete"));
  });

  it("fails when the build output exceeds the capture limit", async (): Promise<void> => {
    const run = vi.fn().mockRejectedValue(new ProcessExecutionError("output_limit"));
    await expect(build(run).run(withBuild)).resolves.toEqual(expected("failed", "npm run build failed"));
  });

  it("uses the scan cwd and runs npm run build without a shell", async (): Promise<void> => {
    const run = vi.fn().mockResolvedValue(ok());
    await build(run).run(withBuild);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0]).toMatchObject({
      file: "npm", args: ["run", "build"], cwd: withBuild.cwd, timeoutMs: 120_000,
    });
  });

  it("records the elapsed duration measured by the clock", async (): Promise<void> => {
    now.mockReset(); now.mockReturnValueOnce(1000).mockReturnValue(1042);
    const run = vi.fn().mockResolvedValue(ok());
    expect((await build(run).run(withBuild)).durationMs).toBe(42);
  });
});

describe("BuildScanner wiring", (): void => {
  it("resolves through ScannersModule with emitted constructor metadata", async (): Promise<void> => {
    const moduleRef = await Test.createTestingModule({ imports: [ScannersModule] }).compile();
    try {
      const scanner = moduleRef.get(BuildScanner);
      expect(scanner).toBeInstanceOf(BuildScanner);
      expect(scanner.id).toBe("build");
      expect(scanner.name).toBe("Build");
      expect(scanner.weight).toBe(SCANNER_WEIGHTS.build);
      expect(Reflect.getMetadata("design:paramtypes", BuildScanner)).toEqual([ProcessRunner, Clock]);
    } finally {
      await moduleRef.close();
    }
  });
});
