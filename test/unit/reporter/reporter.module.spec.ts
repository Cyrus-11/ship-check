import "reflect-metadata";

import { Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import ora from "ora";
import { describe, expect, it, vi } from "vitest";

import { ReporterModule } from "../../../src/reporter/reporter.module.js";
import { REPORTER_CAPABILITIES, REPORTER_OUTPUT, REPORTER_VERSION } from "../../../src/reporter/reporter.tokens.js";
import { TerminalReporter } from "../../../src/reporter/terminal-reporter.service.js";
import { reporterFixture } from "../../helpers/reporter-fixture.js";

vi.mock("ora", (): object => ({ default: vi.fn() }));

@Injectable()
class ReporterConsumer {
  public constructor(public readonly reporter: TerminalReporter) {}
}

describe("ReporterModule", (): void => {
  it("exports a silent singleton and stops active progress when the module closes", async (): Promise<void> => {
    const stop = vi.fn();
    const start = vi.fn();
    // Mock only the used package methods; no animation is run in this test.
    vi.mocked(ora).mockReturnValue({ start, stop } as unknown as ora.Ora);
    const writeStdout = vi.fn().mockResolvedValue(undefined);
    const writeStderr = vi.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({ imports: [ReporterModule], providers: [ReporterConsumer] })
      .overrideProvider(REPORTER_VERSION).useValue("9.8.7")
      .overrideProvider(REPORTER_OUTPUT).useValue({ stdout: process.stdout, writeStdout, writeStderr })
      .overrideProvider(REPORTER_CAPABILITIES).useValue({ stdoutIsTTY: true, noColor: undefined, testMode: false })
      .compile();
    try {
      const reporter = moduleRef.get(ReporterConsumer).reporter;
      expect(reporter).toBeInstanceOf(TerminalReporter);
      expect(reporter).toBe(moduleRef.get(TerminalReporter));
      expect(writeStdout).not.toHaveBeenCalled();
      expect(writeStderr).not.toHaveBeenCalled();
      expect(ora).not.toHaveBeenCalled();
      await reporter.report(reporterFixture(), { ci: true });
      expect(writeStdout).toHaveBeenCalledWith(expect.stringMatching(/^Shipcheck v9\.8\.7\n/));
      reporter.startScanner("git", { ci: false });
      expect(start).toHaveBeenCalledTimes(1);
    } finally {
      await moduleRef.close();
    }
    expect(stop).toHaveBeenCalledTimes(1);
    expect(writeStderr).not.toHaveBeenCalled();
  });

  it("requires the reporter module at the consumer boundary", async (): Promise<void> => {
    await expect(Test.createTestingModule({ providers: [ReporterConsumer] }).compile()).rejects.toThrow();
  });
});
