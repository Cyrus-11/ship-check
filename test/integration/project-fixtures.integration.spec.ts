import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { projectFixtures, runProjectCli, snapshotFiles, snapshotGit, withProjectFixture } from "../helpers/project-fixture.js";

import type { FileSnapshot, ProjectFixtureName } from "../helpers/project-fixture.js";

type ExpectedScan = {
  fixture: ProjectFixtureName;
  git: string;
  build: string;
  test: string;
  env: string;
  counts: string;
  score: number;
  status: string;
  gate: string;
};

const passedGit = "✓ Git          Working tree is clean (main)\n";
const passedBuild = "✓ Build        npm run build passed\n";
const passedTest = "✓ Tests        npm test passed\n";
const passedEnv = "✓ Environment  2 required variables are present\n";
const ready = { git: passedGit, build: passedBuild, test: passedTest, env: passedEnv,
  counts: "4 passed, 0 failed, 0 skipped", score: 100, status: "READY", gate: "PASSED" };
const review = { counts: "3 passed, 1 failed, 0 skipped", score: 75, status: "REVIEW", gate: "FAILED" };
const cases: ExpectedScan[] = [
  { fixture: "ready", ...ready },
  { ...ready, ...review, fixture: "dirty-git", git: "✗ Git          Working tree has 1 changed files\n" },
  { ...ready, ...review, fixture: "failing-build", build: "✗ Build        npm run build failed\n" },
  { ...ready, ...review, fixture: "failing-test", test: "✗ Tests        npm test failed\n" },
  { ...ready, ...review, fixture: "missing-env", env: "✗ Environment  Missing 2 required variables\n" +
    "  - SHIPCHECK_FIXTURE_ALPHA\n  - SHIPCHECK_FIXTURE_ZULU\n" },
  { ...ready, fixture: "no-env-example", env: "○ Environment  No .env.example found\n",
    counts: "3 passed, 0 failed, 1 skipped" },
];
const modes = [{ ci: false, mode: "local" }, { ci: true, mode: "CI" }];
let sourceBefore: FileSnapshot;
let version: string;

function expectedReport(scan: ExpectedScan, directory: string): string {
  return `Shipcheck v${version}\n\nProject: fixture-${scan.fixture}\nPath: ${directory}\n\n` +
    scan.git + scan.build + scan.test + scan.env +
    `\nChecks: ${scan.counts}\nRelease score: ${scan.score}/100\nStatus: ${scan.status}\nRelease gate: ${scan.gate}\n`;
}

function expectedFiles(before: FileSnapshot): FileSnapshot {
  return {
    ...before,
    ".generated": { type: "directory", content: "" },
    ".generated/build.txt": { type: "file", content: Buffer.from("build completed\n").toString("base64") },
    ".generated/test.txt": { type: "file", content: Buffer.from("tests completed with CI=true\n").toString("base64") },
  };
}

describe("compiled CLI project fixtures", { concurrent: false }, (): void => {
  beforeAll(async (): Promise<void> => {
    sourceBefore = await snapshotFiles(projectFixtures);
    // The version is package metadata, not part of the fixture's readiness expectation.
    const metadata: unknown = JSON.parse(await readFile("package.json", "utf8"));
    if (typeof metadata !== "object" || metadata === null || !("version" in metadata)
      || typeof metadata.version !== "string") throw new Error("Package version must be a string");
    version = metadata.version;
  });

  afterAll(async (): Promise<void> => {
    expect(await snapshotFiles(projectFixtures)).toEqual(sourceBefore);
  });

  for (const scan of cases) {
    it.each(modes)(`${scan.fixture} reports ${scan.status} in $mode with only expected script artifacts`,
      async ({ ci }): Promise<void> => {
        await withProjectFixture(scan.fixture, async (fixture): Promise<void> => {
          expect(fixture.gitBefore?.staged).toBe("");
          expect(fixture.gitBefore?.status).toBe(scan.fixture === "dirty-git"
            ? "?? test-only-untracked-path.txt\n" : "");
          const result = await runProjectCli(fixture, ci);
          expect(result.timedOut).toBe(false);
          expect(result.exitCode).toBe(ci && scan.gate === "FAILED" ? 1 : 0);
          expect(result.stderr).toBe("");
          expect(result.stdout).toBe(expectedReport(scan, fixture.directory));
          expect(result.stdout + result.stderr).not.toMatch(
            /\u001b|\r|\[Nest\]|test-only-|Error:|\bat .+\(.+:\d+:\d+\)/u,
          );
          expect(await snapshotFiles(fixture.directory)).toEqual(expectedFiles(fixture.filesBefore));
          expect(await snapshotGit(fixture)).toEqual(fixture.gitBefore);
        });
      }, 60_000,
    );
  }

  for (const malformed of [false, true]) {
    it.each(modes)(`${malformed ? "malformed" : "missing"} manifest exits 2 in $mode without scanning or mutation`,
      async ({ ci }): Promise<void> => {
        await withProjectFixture("invalid-project", async (fixture): Promise<void> => {
          const result = await runProjectCli(fixture, ci);
          expect(result.timedOut).toBe(false);
          expect(result.exitCode).toBe(2);
          expect(result.stdout).toBe("");
          expect(result.stderr).toBe("Shipcheck could not scan this directory: package.json " +
            (malformed ? "is not valid JSON.\n" : "was not found.\n") +
            "Run the command from the root of a Node.js project.\n");
          expect(await snapshotFiles(fixture.directory)).toEqual(fixture.filesBefore);
        }, malformed);
      }, 60_000,
    );
  }
});
