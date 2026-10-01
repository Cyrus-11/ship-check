import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

const probe = fileURLToPath(new URL("../helpers/terminal-reporter-probe.js", import.meta.url));

describe("production terminal reporter", (): void => {
  it.each([
    { name: "non-TTY despite FORCE_COLOR", env: { FORCE_COLOR: "3", NO_COLOR: undefined }, args: [] },
    { name: "NO_COLOR including empty value", env: { FORCE_COLOR: undefined, NO_COLOR: "" }, args: [] },
    { name: "explicit CI", env: { FORCE_COLOR: undefined, NO_COLOR: undefined }, args: ["--ci"] },
  ])("renders plain stdout from an unrelated cwd: $name", async ({ env, args }): Promise<void> => {
    const cwd = await mkdtemp(join(tmpdir(), "shipcheck-reporter-"));
    try {
      const result = await execa(process.execPath, [probe, "ready", "--progress", ...args], {
        cwd, env: { ...env, VITEST: undefined, NODE_ENV: undefined },
        timeout: 10_000, maxBuffer: 1_000_000, stripFinalNewline: false, reject: false,
      });
      const snapshot = await readFile(new URL("../../../test/fixtures/reporter/ready.txt", import.meta.url), "utf8");
      const manifest = JSON.parse(await readFile(new URL("../../../package.json", import.meta.url), "utf8")) as { version: string };
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toBe(snapshot.replace("v0.1.0", `v${manifest.version}`));
      expect(result.stdout).not.toContain("\u001b");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("constructs and closes the production module without output", async (): Promise<void> => {
    const result = await execa(process.execPath, [probe, "--silent"], {
      env: { NO_COLOR: "1", FORCE_COLOR: undefined }, timeout: 10_000, reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});
