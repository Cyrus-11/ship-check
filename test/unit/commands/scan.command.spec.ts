import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandsModule } from "../../../src/commands/commands.module.js";
import { ScanCommand } from "../../../src/commands/scan.command.js";
import { selectExitCode } from "../../../src/commands/select-exit-code.js";
import { ScanService } from "../../../src/scan/scan.service.js";

import type { ScanShellReport } from "../../../src/scan/scan-shell-report.type.js";

describe("scan command", (): void => {
  let originalExitCode: typeof process.exitCode;

  beforeEach((): void => {
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach((): void => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it.each([
    { ci: false, gatePassed: false, code: 0 },
    { ci: false, gatePassed: true, code: 0 },
    { ci: true, gatePassed: false, code: 1 },
    { ci: true, gatePassed: true, code: 0 },
  ])("selects exit $code for ci=$ci and gate=$gatePassed", async ({ ci, gatePassed, code }): Promise<void> => {
    const scan = vi.fn<ScanService["scan"]>().mockResolvedValue({ gatePassed });
    const command = new ScanCommand({ scan });

    await command.run([], { ci });

    expect(scan).toHaveBeenCalledExactlyOnceWith({ ci });
    expect(selectExitCode({ gatePassed }, ci)).toBe(code);
    expect(process.exitCode).toBe(code);
  });

  it("resolves the command service through Nest and defaults absent options to local", async (): Promise<void> => {
    const scan = vi.fn<ScanService["scan"]>().mockResolvedValue({ gatePassed: false });
    const moduleRef = await Test.createTestingModule({ imports: [CommandsModule] })
      .overrideProvider(ScanService).useValue({ scan }).compile();
    try {
      await moduleRef.get(ScanCommand).run([]);
      expect(scan).toHaveBeenCalledExactlyOnceWith({ ci: false });
      expect(process.exitCode).toBe(0);
    } finally {
      await moduleRef.close();
    }
  });

  it("waits for the service to finish before assigning an exit", async (): Promise<void> => {
    let complete: (report: ScanShellReport) => void = (): never => {
      throw new Error("Deferred scan has not initialized");
    };
    const report = new Promise<ScanShellReport>((resolve): void => { complete = resolve; });
    const command = new ScanCommand({ scan: (): Promise<ScanShellReport> => report });

    const execution = command.run([], { ci: true });
    expect(process.exitCode).toBeUndefined();
    complete({ gatePassed: false });
    await execution;
    expect(process.exitCode).toBe(1);
  });

  it("propagates a service rejection without selecting a completed-scan exit", async (): Promise<void> => {
    const failure = new Error("test-only-service-failure");
    const command = new ScanCommand({ scan: vi.fn<ScanService["scan"]>().mockRejectedValue(failure) });

    await expect(command.run([], { ci: true })).rejects.toBe(failure);
    expect(process.exitCode).toBeUndefined();
  });
});
