import "reflect-metadata";

import { CommandFactory } from "nest-commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrap } from "../../src/bootstrap.js";

describe("bootstrap failure boundary", (): void => {
  let originalExitCode: typeof process.exitCode;

  beforeEach((): void => {
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach((): void => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it("does not start Nest when package metadata cannot load", async (): Promise<void> => {
    const run = vi.spyOn(CommandFactory, "run").mockResolvedValue();

    await bootstrap(async (): Promise<string> => {
      throw new Error("test-only-secret-metadata");
    });

    expect(run).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(process.stderr.write).toHaveBeenCalledExactlyOnceWith("Shipcheck could not complete the command.\n");
  });

  it.each([new Error("test-only-secret-startup"), "test-only-secret-rejection"])(
    "safely reports a rejected factory call (%#)",
    async (failure: unknown): Promise<void> => {
      vi.spyOn(CommandFactory, "run").mockRejectedValue(failure);

      await bootstrap(async (): Promise<string> => "9.8.7");

      expect(process.exitCode).toBe(2);
      expect(process.stderr.write).toHaveBeenCalledExactlyOnceWith("Shipcheck could not complete the command.\n");
    },
  );

  it("preserves the exit decision of a completed command", async (): Promise<void> => {
    vi.spyOn(CommandFactory, "run").mockImplementation(async (): Promise<void> => {
      process.exitCode = 1;
    });

    await bootstrap(async (): Promise<string> => "9.8.7");

    expect(process.exitCode).toBe(1);
    expect(process.stderr.write).not.toHaveBeenCalled();
  });
});
