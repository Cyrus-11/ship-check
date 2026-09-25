import "reflect-metadata";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SCANNER_WEIGHTS } from "../../src/common/constants/scoring.js";
import { Clock } from "../../src/infrastructure/clock.service.js";
import { FileSystem } from "../../src/infrastructure/file-system.service.js";
import { ProcessRunner } from "../../src/infrastructure/process-runner.service.js";
import { TestScanner } from "../../src/scanners/test/test.scanner.js";

import type { PackageJson } from "../../src/common/types/package-json.type.js";
import type { ScanContext } from "../../src/common/types/scan-context.type.js";

const scanner = new TestScanner(new ProcessRunner(new FileSystem()), new Clock());
let directory: string;

async function writeProject(scripts?: { readonly test?: string }): Promise<PackageJson> {
  const packageJson: PackageJson = scripts === undefined ? { name: "fixture" } : { name: "fixture", scripts };
  await writeFile(join(directory, "package.json"), JSON.stringify(packageJson));
  return packageJson;
}

function contextFor(packageJson: PackageJson): ScanContext {
  return { cwd: directory, projectName: "fixture", packageJsonPath: join(directory, "package.json"), packageJson, ci: false };
}

beforeEach(async (): Promise<void> => { directory = await mkdtemp(join(tmpdir(), "shipcheck-test-")); });
afterEach(async (): Promise<void> => { if (directory !== undefined) await rm(directory, { recursive: true, force: true }); });

describe("TestScanner integration", (): void => {
  it("passes when the test script exits zero", async (): Promise<void> => {
    const packageJson = await writeProject({ test: "node -e \"process.exit(0)\"" });

    const result = await scanner.run(contextFor(packageJson));
    expect(result).toMatchObject({
      id: "test", name: "Tests", status: "passed",
      summary: "npm test passed", details: [], weight: SCANNER_WEIGHTS.test,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it("fails when the test script exits non-zero", async (): Promise<void> => {
    const packageJson = await writeProject({ test: "node -e \"process.exit(1)\"" });

    const result = await scanner.run(contextFor(packageJson));
    expect(result).toMatchObject({ status: "failed", summary: "npm test failed", details: [] });
  }, 60_000);

  it("fails without spawning npm when the test script is missing", async (): Promise<void> => {
    const packageJson = await writeProject();

    const result = await scanner.run(contextFor(packageJson));
    expect(result).toMatchObject({ status: "failed", summary: "package.json has no test script", details: [] });
  }, 20_000);

  it("adds CI=true for the test command without mutating the parent environment", async (): Promise<void> => {
    const ciBefore = process.env.CI;
    const packageJson = await writeProject({ test: "node -e \"process.exit(process.env.CI === 'true' ? 0 : 1)\"" });

    const result = await scanner.run(contextFor(packageJson));
    expect(result).toMatchObject({ status: "passed", summary: "npm test passed" });
    expect(process.env.CI).toBe(ciBefore);
  }, 60_000);
});
