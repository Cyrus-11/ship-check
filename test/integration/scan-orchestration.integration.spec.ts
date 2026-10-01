import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("production scan orchestration", (): void => {
  it("runs controlled scanners sequentially through compiled DI and renders one report", async (): Promise<void> => {
    const probe = fileURLToPath(new URL("../helpers/scan-orchestration-probe.js", import.meta.url));
    const directory = await mkdtemp(join(tmpdir(), "shipcheck-orchestration-"));
    try {
      await writeFile(join(directory, "package.json"), '{ "name": "test-only-project" }', "utf8");
      const result = await execa(process.execPath, [probe, "--ci"], {
        cwd: directory, env: { NO_COLOR: "1" }, timeout: 10_000, maxBuffer: 1_000_000,
        stripFinalNewline: false, reject: false,
      });
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).not.toMatch(/test-only-secret|\u001b/);

      const { version } = JSON.parse(await readFile("package.json", "utf8")) as { version: string };
      const [report, observations] = result.stdout.split(/\n(?=\{)/u);
      expect(`${report ?? ""}\n`).toBe(
        `Shipcheck v${version}\n\nProject: test-only-project\nPath: ${await realpath(directory)}\n\n` +
        "✓ Git          Working tree is clean (main)\n" +
        "! Build        Scanner could not complete\n" +
        "✗ Tests        npm test failed\n" +
        "○ Environment  No .env.example found\n\n" +
        "Checks: 1 passed, 2 failed, 1 skipped\nRelease score: 33/100\nStatus: NOT READY\nRelease gate: FAILED\n",
      );
      expect(JSON.parse(observations ?? "null")).toEqual({
        events: [
          "run:git", "settled:git", "run:build", "settled:build",
          "run:test", "settled:test", "run:env", "settled:env", "report",
        ],
        sameContext: true,
        sameReport: true,
        results: [
          "git:passed:Working tree is clean (main)", "build:error:Scanner could not complete",
          "test:failed:npm test failed", "env:skipped:No .env.example found",
        ],
        score: 33, status: "NOT_READY", gatePassed: false, durationIsWhole: true,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 15_000);
});
