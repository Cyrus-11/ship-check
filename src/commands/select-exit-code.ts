import { EXIT_CODE } from "../common/constants/exit-codes.js";

import type { ScanReport } from "../common/types/scan-report.type.js";

export function selectExitCode(report: Pick<ScanReport, "gatePassed">, ci: boolean): number {
  return ci && !report.gatePassed ? EXIT_CODE.GATE_FAILED : EXIT_CODE.SUCCESS;
}
