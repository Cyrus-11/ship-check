import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandsModule } from "../../../src/commands/commands.module.js";
import { ScanCommand } from "../../../src/commands/scan.command.js";
import { selectExitCode } from "../../../src/commands/select-exit-code.js";
import { REPORTER_VERSION } from "../../../src/reporter/reporter.tokens.js";
import { ScanService } from "../../../src/scan/scan.service.js";
import { reporterFixture } from "../../helpers/reporter-fixture.js";

import type { ScanReport } from "../../../src/common/types/scan-report.type.js";

function completed(gatePassed: boolean): ScanReport {
  return { ...reporterFixture(gatePassed ? "ready" : "review"), gatePassed };
}

// The command consumes only scan(); discover() and its FileSystem port are never reached here.
function commandWith(scan: ScanService["scan"]): ScanCommand {
  return new ScanCommand({ scan } as unknown as ScanService);
}

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
    const scan = vi.fn<ScanService["scan"]>().mockResolvedValue(completed(gatePassed));
    const command = commandWith(scan);

    await command.run([], { ci });

    expect(scan).toHaveBeenCalledExactlyOnceWith({ ci });
    expect(selectExitCode({ gatePassed }, ci)).toBe(code);
    expect(process.exitCode).toBe(code);
  });

  it("resolves the command service through Nest and defaults absent options to local", async (): Promise<void> => {
    const scan = vi.fn<ScanService["scan"]>().mockResolvedValue(completed(false));
    const moduleRef = await Test.createTestingModule({ imports: [CommandsModule] })
      .overrideProvider(ScanService).useValue({ scan })
      .overrideProvider(REPORTER_VERSION).useValue("0.0.0-test").compile();
    try {
      await moduleRef.get(ScanCommand).run([]);
      expect(scan).toHaveBeenCalledExactlyOnceWith({ ci: false });
      expect(process.exitCode).toBe(0);
    } finally {
      await moduleRef.close();
    }
  });

  it("waits for the service to finish before assigning an exit", async (): Promise<void> => {
    let complete: (report: ScanReport) => void = (): never => {
      throw new Error("Deferred scan has not initialized");
    };
    const report = new Promise<ScanReport>((resolve): void => { complete = resolve; });
    const command = commandWith((): Promise<ScanReport> => report);

    const execution = command.run([], { ci: true });
    expect(process.exitCode).toBeUndefined();
    complete(completed(false));
    await execution;
    expect(process.exitCode).toBe(1);
  });

  it("propagates a service rejection without selecting a completed-scan exit", async (): Promise<void> => {
    const failure = new Error("test-only-service-failure");
    const command = commandWith(vi.fn<ScanService["scan"]>().mockRejectedValue(failure));

    await expect(command.run([], { ci: true })).rejects.toBe(failure);
    expect(process.exitCode).toBeUndefined();
  });
});
