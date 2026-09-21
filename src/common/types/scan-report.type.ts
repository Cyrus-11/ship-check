import type { ReadinessStatus } from "./readiness-status.type.js";
import type { ScanResult } from "./scan-result.type.js";

export type ScanReport = {
  projectName: string;
  cwd: string;
  results: ScanResult[];
  score: number;
  status: ReadinessStatus;
  gatePassed: boolean;
  durationMs: number;
};
