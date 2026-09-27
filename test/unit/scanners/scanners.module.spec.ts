import "reflect-metadata";

import { Inject, Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SCAN_ORDER } from "../../../src/common/constants/scan-order.js";
import { SCANNER_WEIGHTS } from "../../../src/common/constants/scoring.js";
import { FileSystem } from "../../../src/infrastructure/file-system.service.js";
import { ProcessRunner } from "../../../src/infrastructure/process-runner.service.js";
import { ScanModule } from "../../../src/scan/scan.module.js";
import { ScanService } from "../../../src/scan/scan.service.js";
import { BuildScanner } from "../../../src/scanners/build/build.scanner.js";
import { EnvScanner } from "../../../src/scanners/env/env.scanner.js";
import { GitScanner } from "../../../src/scanners/git/git.scanner.js";
import { SCANNERS } from "../../../src/scanners/scanner.tokens.js";
import { ScannersModule } from "../../../src/scanners/scanners.module.js";
import { TestScanner } from "../../../src/scanners/test/test.scanner.js";

import type { TestingModule } from "@nestjs/testing";
import type { Scanner } from "../../../src/common/contracts/scanner.contract.js";

@Injectable()
class RegistryConsumer {
  public constructor(@Inject(SCANNERS) public readonly scanners: Scanner[]) {}
}

describe("scanner registry", (): void => {
  let moduleRef: TestingModule;
  let scanners: Scanner[];

  beforeEach(async (): Promise<void> => {
    moduleRef = await Test.createTestingModule({ imports: [ScanModule] }).compile();
    scanners = moduleRef.get<Scanner[]>(SCANNERS);
  });

  afterEach(async (): Promise<void> => { await moduleRef.close(); });

  it("contains exactly four unique IDs in canonical display order", (): void => {
    expect(scanners).toHaveLength(4);
    expect(scanners.map((scanner): string => scanner.id)).toEqual(SCAN_ORDER);
    expect(new Set(scanners.map((scanner): string => scanner.id)).size).toBe(4);
    expect(scanners.map((scanner): string => scanner.name)).toEqual(["Git", "Build", "Tests", "Environment"]);
  });

  it("assigns 25 points to each scanner and 100 in total", (): void => {
    for (const scanner of scanners) {
      expect(scanner.weight).toBe(SCANNER_WEIGHTS[scanner.id]);
      expect(scanner.weight).toBe(25);
    }
    expect(scanners.reduce((sum, scanner): number => sum + scanner.weight, 0)).toBe(100);
  });

  it("reuses the concrete singleton providers and registry array", (): void => {
    expect(scanners[0]).toBe(moduleRef.get(GitScanner));
    expect(scanners[1]).toBe(moduleRef.get(BuildScanner));
    expect(scanners[2]).toBe(moduleRef.get(TestScanner));
    expect(scanners[3]).toBe(moduleRef.get(EnvScanner));
    expect(moduleRef.get<Scanner[]>(SCANNERS)).toBe(scanners);
    expect(moduleRef.get(ScanService)).toBeInstanceOf(ScanService);
  });
});

describe("scanner registry module boundaries", (): void => {
  it("exports the token for constructor injection in an importing module", async (): Promise<void> => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScannersModule], providers: [RegistryConsumer],
    }).compile();
    try {
      expect(moduleRef.get(RegistryConsumer).scanners).toBe(moduleRef.get<Scanner[]>(SCANNERS));
    } finally {
      await moduleRef.close();
    }
  });

  it("rejects a consumer without the exporting module", async (): Promise<void> => {
    await expect(Test.createTestingModule({ providers: [RegistryConsumer] }).compile())
      .rejects.toThrow("SCANNERS");
  });

  it("constructs and closes the scan module without running checks or accessing the project", async (): Promise<void> => {
    // Reject accidental work immediately instead of executing real Git/npm or file reads.
    const unexpected = (): never => { throw new Error("Registry construction must not run checks"); };
    const spies = [
      vi.spyOn(GitScanner.prototype, "run").mockImplementation(unexpected),
      vi.spyOn(BuildScanner.prototype, "run").mockImplementation(unexpected),
      vi.spyOn(TestScanner.prototype, "run").mockImplementation(unexpected),
      vi.spyOn(EnvScanner.prototype, "run").mockImplementation(unexpected),
      vi.spyOn(ProcessRunner.prototype, "run").mockImplementation(unexpected),
      vi.spyOn(FileSystem.prototype, "readText").mockImplementation(unexpected),
      vi.spyOn(FileSystem.prototype, "exists").mockImplementation(unexpected),
      vi.spyOn(FileSystem.prototype, "resolveWindowsExecutable").mockImplementation(unexpected),
    ];
    try {
      const moduleRef = await Test.createTestingModule({ imports: [ScanModule] }).compile();
      try {
        expect(moduleRef.get<Scanner[]>(SCANNERS)).toHaveLength(4);
      } finally {
        await moduleRef.close();
      }
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
