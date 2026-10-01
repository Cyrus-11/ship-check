import type { ReadinessStatus } from "../common/types/readiness-status.type.js";
import type { ScannerId } from "../common/types/scanner-id.type.js";
import type { ScanStatus } from "../common/types/scan-status.type.js";

export const OUTPUT_SYMBOLS = {
  passed: "✓", failed: "✗", skipped: "○", error: "!",
} as const satisfies Record<ScanStatus, string>;

export const STATUS_LABELS = {
  READY: "READY", REVIEW: "REVIEW", NOT_READY: "NOT READY",
} as const satisfies Record<ReadinessStatus, string>;

export const SCANNER_NAMES = {
  git: "Git", build: "Build", test: "Tests", env: "Environment",
} as const satisfies Record<ScannerId, string>;

export const SPINNER_TEXT = {
  git: "Checking Git state…",
  build: "Running project build…",
  test: "Running project tests…",
  env: "Checking environment…",
} as const satisfies Record<ScannerId, string>;

export const OUTPUT_LABELS = {
  product: "Shipcheck", project: "Project:", path: "Path:", checks: "Checks:",
  score: "Release score:", status: "Status:", gate: "Release gate:",
  gatePassed: "PASSED", gateFailed: "FAILED",
} as const;

export const OUTPUT_SPACING = {
  headingGapLines: 1, metadataGapLines: 1, resultsGapLines: 1,
  scannerNameWidth: 12, detailIndentSpaces: 2, maxVisibleDetails: 5, maxDetailLength: 160,
} as const;
