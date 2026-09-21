import { EXIT_CODE } from "../common/constants/exit-codes.js";

import type { ScanShellReport } from "../scan/scan-shell-report.type.js";

export function selectExitCode(report: ScanShellReport, ci: boolean): number {
  return ci && !report.gatePassed ? EXIT_CODE.GATE_FAILED : EXIT_CODE.SUCCESS;
}
