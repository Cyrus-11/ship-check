import "reflect-metadata";

import { Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { SCAN_ORDER } from "../../../src/common/constants/scan-order.js";
import { SCANNER_WEIGHTS } from "../../../src/common/constants/scoring.js";
import { ScoringModule } from "../../../src/scoring/scoring.module.js";
import { ScoringService } from "../../../src/scoring/scoring.service.js";
import type { ReadinessStatus } from "../../../src/common/types/readiness-status.type.js";
import type { ScannerId } from "../../../src/common/types/scanner-id.type.js";
import type { ScanResult } from "../../../src/common/types/scan-result.type.js";
import type { ScanStatus } from "../../../src/common/types/scan-status.type.js";

function result(id: ScannerId, status: ScanStatus, weight: number = SCANNER_WEIGHTS[id]): ScanResult {
  return { id, name: id, status, weight, summary: "Test result", details: [], durationMs: 1 };
}

function results(statuses: Record<ScannerId, ScanStatus>): ScanResult[] {
  return SCAN_ORDER.map((id): ScanResult => result(id, statuses[id]));
}

@Injectable()
class ScoringConsumer {
  public constructor(public readonly scoring: ScoringService) {}
}

describe("ScoringService", (): void => {
  const service = new ScoringService();

  it.each<{
    name: string;
    statuses: Record<ScannerId, ScanStatus>;
    score: number;
    status: ReadinessStatus;
    gatePassed: boolean;
  }>([
    {
      name: "four passes",
      statuses: { git: "passed", build: "passed", test: "passed", env: "passed" },
      score: 100, status: "READY", gatePassed: true,
    },
    {
      name: "three passes and one failure",
      statuses: { git: "failed", build: "passed", test: "passed", env: "passed" },
      score: 75, status: "REVIEW", gatePassed: false,
    },
    {
      name: "two passes and two failures",
      statuses: { git: "passed", build: "failed", test: "failed", env: "passed" },
      score: 50, status: "NOT_READY", gatePassed: false,
    },
    {
      name: "three passes and one skip",
      statuses: { git: "passed", build: "passed", test: "passed", env: "skipped" },
      score: 100, status: "READY", gatePassed: true,
    },
    {
      name: "three passes and one error",
      statuses: { git: "error", build: "passed", test: "passed", env: "passed" },
      score: 75, status: "REVIEW", gatePassed: false,
    },
    {
      name: "a pass, failure, error, and skip",
      statuses: { git: "passed", build: "failed", test: "error", env: "skipped" },
      score: 33, status: "NOT_READY", gatePassed: false,
    },
    {
      name: "four failures",
      statuses: { git: "failed", build: "failed", test: "failed", env: "failed" },
      score: 0, status: "NOT_READY", gatePassed: false,
    },
    {
      name: "four errors",
      statuses: { git: "error", build: "error", test: "error", env: "error" },
      score: 0, status: "NOT_READY", gatePassed: false,
    },
    {
      name: "all skipped",
      statuses: { git: "skipped", build: "skipped", test: "skipped", env: "skipped" },
      score: 0, status: "NOT_READY", gatePassed: false,
    },
  ])("scores $name", ({ statuses, score, status, gatePassed }): void => {
    expect(service.calculate(results(statuses))).toEqual({ score, status, gatePassed });
  });

  it("fails the gate for an empty result collection", (): void => {
    expect(service.calculate([])).toEqual({ score: 0, status: "NOT_READY", gatePassed: false });
  });

  it("excludes skipped weight from both sums and uses supplied applicable weights", (): void => {
    expect(service.calculate([
      result("git", "passed", 30),
      result("build", "failed", 10),
      result("env", "skipped", 1_000),
    ])).toEqual({ score: 75, status: "REVIEW", gatePassed: false });
  });

  // Varied weights exercise policy boundaries unreachable with four equal weights.
  it.each<{
    passedWeight: number;
    score: number;
    status: ReadinessStatus;
    gatePassed: boolean;
  }>([
    { passedWeight: 690, score: 69, status: "NOT_READY", gatePassed: false },
    { passedWeight: 700, score: 70, status: "REVIEW", gatePassed: false },
    { passedWeight: 890, score: 89, status: "REVIEW", gatePassed: false },
    { passedWeight: 900, score: 90, status: "READY", gatePassed: true },
    { passedWeight: 694, score: 69, status: "NOT_READY", gatePassed: false },
    { passedWeight: 695, score: 70, status: "REVIEW", gatePassed: false },
    { passedWeight: 894, score: 89, status: "REVIEW", gatePassed: false },
    { passedWeight: 895, score: 90, status: "READY", gatePassed: true },
  ])("rounds and classifies $passedWeight of 1000 applicable points", ({ passedWeight, score, status, gatePassed }): void => {
    expect(service.calculate([
      result("git", "passed", passedWeight),
      result("build", "failed", 1_000 - passedWeight),
    ])).toEqual({ score, status, gatePassed });
  });

  it("rounds after summing fractional weights rather than each contribution", (): void => {
    expect(service.calculate([
      result("git", "passed", 34.6),
      result("build", "passed", 34.6),
      result("test", "failed", 30.8),
    ])).toEqual({ score: 69, status: "NOT_READY", gatePassed: false });
  });

  it("preserves frozen inputs and scores independently of input order", (): void => {
    const input = Object.freeze(results({ git: "passed", build: "failed", test: "passed", env: "skipped" })
      .map((entry): ScanResult => {
        Object.freeze(entry.details);
        return Object.freeze(entry);
      }));
    const before = structuredClone(input);
    const references = [...input];

    expect(service.calculate(input)).toEqual({ score: 67, status: "NOT_READY", gatePassed: false });
    expect(service.calculate([...input].reverse())).toEqual(service.calculate(input));
    expect(input).toEqual(before);
    input.forEach((entry, index): void => { expect(entry).toBe(references[index]); });
  });

  it("returns independent projections without retaining scores across calls", (): void => {
    const input = results({ git: "passed", build: "passed", test: "passed", env: "passed" });
    const first = service.calculate(input);
    first.score = 0;
    first.status = "NOT_READY";
    first.gatePassed = false;

    expect(service.calculate([])).toEqual({ score: 0, status: "NOT_READY", gatePassed: false });
    const next = service.calculate(input);
    expect(next).toEqual({ score: 100, status: "READY", gatePassed: true });
    expect(next).not.toBe(first);
  });

  it("exports a singleton that can be injected into an importing module's consumer", async (): Promise<void> => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScoringModule],
      providers: [ScoringConsumer],
    }).compile();
    try {
      const scoring = moduleRef.get(ScoringService);
      expect(scoring).toBeInstanceOf(ScoringService);
      expect(moduleRef.get(ScoringConsumer).scoring).toBe(scoring);
      expect(moduleRef.get(ScoringService)).toBe(scoring);
      expect(scoring.calculate([])).toEqual({ score: 0, status: "NOT_READY", gatePassed: false });
    } finally {
      await moduleRef.close();
    }
  });
});
