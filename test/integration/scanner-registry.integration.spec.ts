import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("production scanner registry", (): void => {
  it("resolves the ordered singletons through the compiled ScanModule and closes cleanly", async (): Promise<void> => {
    const probe = fileURLToPath(new URL("../helpers/scanner-registry-probe.js", import.meta.url));
    const result = await execa(process.execPath, [probe], {
      env: { NO_COLOR: "1" }, timeout: 10_000, maxBuffer: 1_000_000,
      stripFinalNewline: false, reject: false,
    });
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(JSON.stringify({
      ids: ["git", "build", "test", "env"], weights: [25, 25, 25, 25],
      sameInstances: true, sameRegistry: true,
    }));
  }, 15_000);
});
