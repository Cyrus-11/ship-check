import { describe, expect, it } from "vitest";

import { EXIT_CODE } from "../../../src/common/constants/exit-codes.js";
import { SCAN_ORDER } from "../../../src/common/constants/scan-order.js";
import { READINESS_THRESHOLDS, SCANNER_WEIGHTS } from "../../../src/common/constants/scoring.js";

describe("v0.1 domain policy", (): void => {
  it("contains exactly four unique scanner IDs in execution order", (): void => {
    expect(SCAN_ORDER).toEqual(["git", "build", "test", "env"]);
    expect(new Set(SCAN_ORDER).size).toBe(4);
  });

  it("assigns 25 points to every scanner and totals 100", (): void => {
    expect(Object.keys(SCANNER_WEIGHTS).sort()).toEqual([...SCAN_ORDER].sort());
    for (const id of SCAN_ORDER) {
      expect(SCANNER_WEIGHTS[id]).toBe(25);
    }
    expect(SCAN_ORDER.reduce((total, id): number => total + SCANNER_WEIGHTS[id], 0)).toBe(100);
  });

  it("defines only the ready and review minimum scores", (): void => {
    expect(READINESS_THRESHOLDS).toEqual({ READY: 90, REVIEW: 70 });
  });

  it("preserves the public exit codes", (): void => {
    expect(EXIT_CODE).toEqual({ SUCCESS: 0, GATE_FAILED: 1, USAGE_OR_INTERNAL: 2 });
  });

  it("prevents runtime changes to scanner order and scoring policy", (): void => {
    expect(Object.isFrozen(SCAN_ORDER)).toBe(true);
    expect(Object.isFrozen(SCANNER_WEIGHTS)).toBe(true);
    expect(Object.isFrozen(READINESS_THRESHOLDS)).toBe(true);
  });
});
