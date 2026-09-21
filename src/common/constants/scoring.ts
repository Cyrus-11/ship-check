import type { ScannerId } from "../types/scanner-id.type.js";

export const SCANNER_WEIGHTS = Object.freeze({
  git: 25,
  build: 25,
  test: 25,
  env: 25,
} as const satisfies Record<ScannerId, number>);

export const READINESS_THRESHOLDS = Object.freeze({
  READY: 90,
  REVIEW: 70,
} as const);
