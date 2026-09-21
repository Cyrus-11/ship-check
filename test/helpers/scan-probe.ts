import "reflect-metadata";

import type { Type } from "@nestjs/common";
import type { ScanService as ScanServiceType } from "../../src/scan/scan.service.js";
import type { ScanShellReport } from "../../src/scan/scan-shell-report.type.js";

const { ScanService }: { ScanService: Type<ScanServiceType> } = await import(
  new URL("../../../dist/scan/scan.service.js", import.meta.url).href
);
const originalScan = ScanService.prototype.scan;

// Observe/replace only the production provider in the subprocess under test.
ScanService.prototype.scan = async function (options: { ci: boolean }): Promise<ScanShellReport> {
  process.stderr.write(`probe:scan:${JSON.stringify(options)}\n`);
  const mode = process.env.SHIPCHECK_SCAN_PROBE;
  if (mode === "reject" || mode === "lookalike") {
    const failure = new Error("test-only-secret-scan");
    if (mode === "lookalike") {
      Object.assign(failure, { code: "commander.helpDisplayed", exitCode: 0 });
    }
    throw failure;
  }
  if (mode === "ready") {
    return { gatePassed: true };
  }
  return originalScan.call(this, options);
};
