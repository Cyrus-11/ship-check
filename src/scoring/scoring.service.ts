import { Injectable } from "@nestjs/common";

import { READINESS_THRESHOLDS } from "../common/constants/scoring.js";
import type { ReadinessStatus } from "../common/types/readiness-status.type.js";
import type { ScanReport } from "../common/types/scan-report.type.js";
import type { ScanResult } from "../common/types/scan-result.type.js";

@Injectable()
export class ScoringService {
  public calculate(results: readonly ScanResult[]): Pick<ScanReport, "score" | "status" | "gatePassed"> {
    let applicableWeight = 0;
    let passedWeight = 0;

    for (const result of results) {
      if (result.status === "skipped") {
        continue;
      }
      applicableWeight += result.weight;
      if (result.status === "passed") {
        passedWeight += result.weight;
      }
    }

    const score = applicableWeight === 0 ? 0 : Math.round((passedWeight / applicableWeight) * 100);
    let status: ReadinessStatus = "NOT_READY";
    if (score >= READINESS_THRESHOLDS.READY) {
      status = "READY";
    } else if (score >= READINESS_THRESHOLDS.REVIEW) {
      status = "REVIEW";
    }

    return { score, status, gatePassed: status === "READY" };
  }
}
