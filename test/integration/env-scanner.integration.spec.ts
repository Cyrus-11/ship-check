import "reflect-metadata";

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SCANNER_WEIGHTS } from "../../src/common/constants/scoring.js";
import { Clock } from "../../src/infrastructure/clock.service.js";
import { FileSystem } from "../../src/infrastructure/file-system.service.js";
import { EnvScanner } from "../../src/scanners/env/env.scanner.js";

import type { ScanContext } from "../../src/common/types/scan-context.type.js";
import type { ScanResult } from "../../src/common/types/scan-result.type.js";

const A = "SHIPCHECK_ENV_FIXTURE_ALPHA";
const B = "SHIPCHECK_ENV_FIXTURE_BETA";
const C = "SHIPCHECK_ENV_FIXTURE_CHARLIE";
const sentinel = "test-only-fixture-value-never-in-results";
const scanner = new EnvScanner(new FileSystem(), new Clock());
let directory: string;

function contextFor(): ScanContext {
  return {
    cwd: directory, projectName: "fixture", packageJsonPath: join(directory, "package.json"), packageJson: {}, ci: false,
  };
}

function expectResult(result: ScanResult, status: ScanResult["status"], summary: string, details: string[] = []): void {
  expect(result).toEqual({
    id: "env", name: "Environment", status, summary, details, weight: SCANNER_WEIGHTS.env,
    durationMs: expect.any(Number),
  });
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(result)).not.toContain(sentinel);
}

beforeEach(async (): Promise<void> => {
  directory = await mkdtemp(join(tmpdir(), "shipcheck env "));
  for (const key of [A, B, C]) vi.stubEnv(key, undefined);
});

afterEach(async (): Promise<void> => {
  vi.unstubAllEnvs();
  if (directory !== undefined) await rm(directory, { recursive: true, force: true });
});

describe("EnvScanner integration", (): void => {
  it("skips a directory without an example and leaves it unchanged", async (): Promise<void> => {
    expectResult(await scanner.run(contextFor()), "skipped", "No .env.example found");
    expect(await readdir(directory)).toEqual([]);
  });

  it("passes from mixed sources without changing environment or fixture files", async (): Promise<void> => {
    const files = new Map([
      [".env.example", `# example\r\n${A}=placeholder\r\n${B}=\r\n${C}=\r\n${A}=duplicate\r\n`],
      [".env", `${A}='${sentinel} # quoted'\r\n${B}=\r\n${C}="  "\r\n`],
      [".env.local", `${A}=\n${B}="test-only\\nmultiline"\n`],
    ]);
    for (const [filename, content] of files) await writeFile(join(directory, filename), content);
    vi.stubEnv(C, "test-only-process");
    const before = { ...process.env };
    expectResult(await scanner.run(contextFor()), "passed", "3 required variables are present");
    expect(Object.keys(before).length === Object.keys(process.env).length
      && Object.entries(before).every(([key, value]): boolean => process.env[key] === value)).toBe(true);
    expect((await readdir(directory)).sort()).toEqual([...files.keys()].sort());
    for (const [filename, content] of files) expect(await readFile(join(directory, filename), "utf8")).toBe(content);
  });

  it("reports sorted missing names for absent and whitespace-only values", async (): Promise<void> => {
    await writeFile(join(directory, ".env.example"), `${C}=\n${B}=${sentinel}\n${A}=\n`);
    await writeFile(join(directory, ".env"), `${A}=" \t "\n${C}=${sentinel}\n`);
    expectResult(await scanner.run(contextFor()), "failed", "Missing 2 required variables", [A, B]);
  });

  it("passes an empty contract without optional environment files", async (): Promise<void> => {
    await writeFile(join(directory, ".env.example"), "# no required names\n\n");
    expectResult(await scanner.run(contextFor()), "passed", "0 required variables are present");
  });

  it.each([".env.example", ".env", ".env.local"])("returns a safe error when %s is a directory", async (filename): Promise<void> => {
    if (filename !== ".env.example") await writeFile(join(directory, ".env.example"), `${A}=${sentinel}\n`);
    await mkdir(join(directory, filename));
    expectResult(await scanner.run(contextFor()), "error", "Scanner could not complete");
  });

  it("runs the production provider through native ESM and Nest injection without extra output", async (): Promise<void> => {
    await writeFile(join(directory, ".env.example"), `${A}=\n${B}=\n`);
    await writeFile(join(directory, ".env"), `${A}=${sentinel}\n`);
    const result = await execa(process.execPath, [
      fileURLToPath(new URL("../helpers/env-scanner-probe.js", import.meta.url)),
    ], {
      cwd: directory, env: { [A]: undefined, [B]: "test-only-process", NO_COLOR: "1" },
      timeout: 10_000, maxBuffer: 1_000_000, reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain(sentinel);
    const observed: unknown = JSON.parse(result.stdout);
    expect(observed).toEqual({
      result: {
        id: "env", name: "Environment", status: "passed", summary: "2 required variables are present",
        details: [], weight: SCANNER_WEIGHTS.env, durationMs: expect.any(Number),
      },
      environmentUnchanged: true,
    });
  }, 15_000);
});
