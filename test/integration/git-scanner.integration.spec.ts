import "reflect-metadata";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { execa } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SCANNER_WEIGHTS } from "../../src/common/constants/scoring.js";
import { Clock } from "../../src/infrastructure/clock.service.js";
import { FileSystem } from "../../src/infrastructure/file-system.service.js";
import { ProcessRunner } from "../../src/infrastructure/process-runner.service.js";
import { GitScanner } from "../../src/scanners/git/git.scanner.js";

import type { ScanContext } from "../../src/common/types/scan-context.type.js";

const scanner = new GitScanner(new ProcessRunner(new FileSystem()), new Clock());
let directory: string;

// Isolate setup commands from the developer's global/system Git config, hooks, and signing.
function isolatedEnv(): NodeJS.ProcessEnv {
  return {
    GIT_CONFIG_GLOBAL: join(directory, "no-global"),
    GIT_CONFIG_SYSTEM: join(directory, "no-system"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
  };
}

async function git(...args: string[]): Promise<void> {
  await execa("git", args, { cwd: directory, env: isolatedEnv(), reject: true, timeout: 10_000 });
}

async function commit(message: string): Promise<void> {
  await git("-c", "user.email=test-only@example.com", "-c", "user.name=Test Only",
    "-c", "commit.gpgsign=false", "commit", "-m", message);
}

function contextFor(): ScanContext {
  return { cwd: directory, projectName: "fixture", packageJsonPath: join(directory, "package.json"), packageJson: {}, ci: false };
}

beforeEach(async (): Promise<void> => { directory = await mkdtemp(join(tmpdir(), "shipcheck-git-")); });
afterEach(async (): Promise<void> => { if (directory !== undefined) await rm(directory, { recursive: true, force: true }); });

describe("GitScanner integration", (): void => {
  it("passes on a clean repository on a named branch", async (): Promise<void> => {
    await git("-c", "init.defaultBranch=main", "init");
    await writeFile(join(directory, "tracked.txt"), "test-only content");
    await git("add", ".");
    await commit("initial");

    const result = await scanner.run(contextFor());
    expect(result).toMatchObject({
      id: "git", name: "Git", status: "passed",
      summary: "Working tree is clean (main)", details: [], weight: SCANNER_WEIGHTS.git,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  }, 20_000);

  it("fails with only a count when the working tree is dirty", async (): Promise<void> => {
    await git("-c", "init.defaultBranch=main", "init");
    await writeFile(join(directory, "tracked.txt"), "test-only content");
    await git("add", ".");
    await commit("initial");
    await writeFile(join(directory, "untracked-secret-name.txt"), "test-only change");

    const result = await scanner.run(contextFor());
    expect(result).toMatchObject({ status: "failed", summary: "Working tree has 1 changed files", details: [] });
    expect(result.summary).not.toContain("untracked-secret-name.txt");
    expect(result.details).toEqual([]);
  }, 20_000);

  it("fails as not a repository outside a Git work tree", async (): Promise<void> => {
    const result = await scanner.run(contextFor());
    expect(result).toMatchObject({ status: "failed", summary: "Not a Git repository", details: [] });
  }, 20_000);
});
