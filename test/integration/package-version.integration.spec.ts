import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("native package metadata loading", (): void => {
  // Run the production loader in Node: Vitest's data-URL import path loses
  // JSON import attributes, which would test a different loader than the CLI.
  it.each([
    { json: '{"version":"9.8.7"}', code: 0, stdout: "9.8.7\n", stderr: "" },
    ...["null", "[]", "{}", '{"version":42}', '{"version":""}', '{"version":"   "}', "invalid"]
      .map((json): { json: string; code: number; stdout: string; stderr: string } => ({
        json, code: 2, stdout: "", stderr: "Package metadata rejected\n",
      })),
  ])("validates $json", async ({ json, code, stdout, stderr }): Promise<void> => {
    const result = await execa(process.execPath, [
      fileURLToPath(new URL("../helpers/package-version-probe.js", import.meta.url)),
      `data:application/json,${encodeURIComponent(json)}`,
    ], {
      env: { NO_COLOR: "1" },
      timeout: 10_000,
      maxBuffer: 1_000_000,
      stripFinalNewline: false,
      reject: false,
    });

    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(code);
    expect(result.stdout).toBe(stdout);
    expect(result.stderr).toBe(stderr);
  }, 15_000);
});
