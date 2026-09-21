import "reflect-metadata";

import { performance } from "node:perf_hooks";

import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { Clock } from "../../../src/infrastructure/clock.service.js";
import { FileSystem } from "../../../src/infrastructure/file-system.service.js";
import { InfrastructureModule } from "../../../src/infrastructure/infrastructure.module.js";
import { ProcessRunner } from "../../../src/infrastructure/process-runner.service.js";

describe("infrastructure providers", (): void => {
  it("provides monotonic milliseconds without rounding", (): void => {
    vi.spyOn(performance, "now").mockReturnValueOnce(10.25).mockReturnValueOnce(12.75);
    const clock = new Clock();
    const start = clock.now();
    expect(clock.now() - start).toBe(2.5);
  });

  it("reads a nondecreasing real monotonic clock", (): void => {
    const clock = new Clock();
    const start = clock.now();
    expect(clock.now()).toBeGreaterThanOrEqual(start);
  });

  it("exports singleton providers with working constructor injection", async (): Promise<void> => {
    const moduleRef = await Test.createTestingModule({ imports: [InfrastructureModule] }).compile();
    try {
      expect(moduleRef.get(Clock)).toBeInstanceOf(Clock);
      expect(moduleRef.get(FileSystem)).toBeInstanceOf(FileSystem);
      expect(moduleRef.get(ProcessRunner)).toBe(moduleRef.get(ProcessRunner));
      expect(Reflect.getMetadata("design:paramtypes", ProcessRunner)).toEqual([FileSystem]);
    } finally {
      await moduleRef.close();
    }
  });

  it("rejects a runner without its filesystem dependency", async (): Promise<void> => {
    await expect(Test.createTestingModule({ providers: [ProcessRunner] }).compile()).rejects.toThrow("FileSystem");
  });
});
