import "reflect-metadata";

import { reporterFixture } from "./reporter-fixture.js";

import type { Type } from "@nestjs/common";
import type { ScanService as ScanServiceType } from "../../src/scan/scan.service.js";
import type { ScanReport } from "../../src/common/types/scan-report.type.js";

const { ScanService }: { ScanService: Type<ScanServiceType> } = await import(
  new URL("../../../dist/scan/scan.service.js", import.meta.url).href
);

// Replace only the production provider in the subprocess under test. No mode delegates
// to the real pipeline: scanning this repository would run its own test suite recursively.
ScanService.prototype.scan = async function (options: { ci: boolean }): Promise<ScanReport> {
  process.stderr.write(`probe:scan:${JSON.stringify(options)}\n`);
  const mode = process.env.SHIPCHECK_SCAN_PROBE;
  if (mode === "reject" || mode === "lookalike") {
    const failure = new Error("test-only-secret-scan");
    if (mode === "lookalike") {
      Object.assign(failure, { code: "commander.helpDisplayed", exitCode: 0 });
    }
    throw failure;
  }
  return mode === "ready" ? reporterFixture("ready") : reporterFixture("review");
};
