import type { ScannerId } from "../types/scanner-id.type.js";
import type { ScanContext } from "../types/scan-context.type.js";
import type { ScanResult } from "../types/scan-result.type.js";

export interface Scanner {
  readonly id: ScannerId;
  readonly name: string;
  readonly weight: number;
  run(context: ScanContext): Promise<ScanResult>;
}
