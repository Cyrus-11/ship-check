import type { ScannerId } from "./scanner-id.type.js";
import type { ScanStatus } from "./scan-status.type.js";

export type ScanResult = {
  id: ScannerId;
  name: string;
  status: ScanStatus;
  summary: string;
  details: string[];
  durationMs: number;
  weight: number;
};
