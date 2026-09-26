import "reflect-metadata";

import { join, resolve } from "node:path";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SCANNER_WEIGHTS } from "../../../../src/common/constants/scoring.js";
import { Clock } from "../../../../src/infrastructure/clock.service.js";
import { FileSystem } from "../../../../src/infrastructure/file-system.service.js";
import { EnvScanner } from "../../../../src/scanners/env/env.scanner.js";
import { ScannersModule } from "../../../../src/scanners/scanners.module.js";

import type { ScanContext } from "../../../../src/common/types/scan-context.type.js";
import type { ScanResult } from "../../../../src/common/types/scan-result.type.js";
import type { ScanStatus } from "../../../../src/common/types/scan-status.type.js";

const A = "SHIPCHECK_ENV_UNIT_ALPHA";
const B = "SHIPCHECK_ENV_UNIT_BETA";
const C = "SHIPCHECK_ENV_UNIT_CHARLIE";
const D = "SHIPCHECK_ENV_UNIT_DELTA";
const E = "SHIPCHECK_ENV_UNIT_ECHO";
const F = "SHIPCHECK_ENV_UNIT_FOXTROT";
const keys = [A, B, C, D, E, F];
const sentinel = "test-only-env-value-never-in-results";
const cwd = resolve("test-only-env-project");
const context: ScanContext = {
  cwd, projectName: "fixture", packageJsonPath: join(cwd, "package.json"), packageJson: {}, ci: false,
};
const files = new Map<string, string>();
const fileSystem = new FileSystem();
const clock = new Clock();
const scanner = new EnvScanner(fileSystem, clock);

function put(filename: string, content: string): void { files.set(join(cwd, filename), content); }

function expected(status: ScanStatus, summary: string, details: string[] = [], durationMs = 25): ScanResult {
  return { id: "env", name: "Environment", status, summary, details, durationMs, weight: SCANNER_WEIGHTS.env };
}

beforeEach((): void => {
  files.clear();
  for (const key of keys) vi.stubEnv(key, undefined);
  vi.spyOn(clock, "now").mockReturnValueOnce(1000).mockReturnValue(1025);
  vi.spyOn(fileSystem, "exists").mockImplementation(async (path): Promise<boolean> => files.has(path));
  vi.spyOn(fileSystem, "readText").mockImplementation(async (path): Promise<string> => {
    const content = files.get(path);
    if (content === undefined) throw Object.assign(new Error("test-only absent file"), { code: "ENOENT" });
    return content;
  });
});

afterEach((): void => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("EnvScanner", (): void => {
  it("skips a missing example without reading optional files", async (): Promise<void> => {
    put(".env", `${A}=${sentinel}`);
    await expect(scanner.run(context)).resolves.toEqual(expected("skipped", "No .env.example found"));
    expect(fileSystem.exists).toHaveBeenCalledExactlyOnceWith(join(cwd, ".env.example"));
    expect(fileSystem.readText).not.toHaveBeenCalled();
  });

  it.each([".env", ".env.local", "process.env"])("passes with all names supplied by %s", async (source): Promise<void> => {
    put(".env.example", `${A}=example-only\n${B}=`);
    if (source === "process.env") {
      vi.stubEnv(A, sentinel);
      vi.stubEnv(B, "test-only-second");
    } else {
      put(source, `${A}=${sentinel}\n${B}=test-only-second`);
    }
    const result = await scanner.run(context);
    expect(result).toEqual(expected("passed", "2 required variables are present"));
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it("combines sources without mutating the process environment or reading outside the scan directory", async (): Promise<void> => {
    put(".env.example", `${A}=\n${B}=\n${C}=`);
    put(".env", `${A}=${sentinel}\n${C}=test-only-file`);
    put(".env.local", `${B}=test-only-local\n${C}=`);
    vi.stubEnv(C, "test-only-process");
    const before = { ...process.env };
    expect(await scanner.run(context)).toEqual(expected("passed", "3 required variables are present"));
    // A boolean comparison avoids printing the developer's environment on assertion failure.
    expect(Object.keys(before).length === Object.keys(process.env).length
      && Object.entries(before).every(([key, value]): boolean => process.env[key] === value)).toBe(true);
    expect(fileSystem.readText).toHaveBeenCalledTimes(3);
    for (const filename of [".env.example", ".env", ".env.local"]) {
      expect(fileSystem.readText).toHaveBeenCalledWith(join(cwd, filename));
    }
  });

  it.each([".env", ".env.local", "process.env"])("accepts a non-empty %s value when the other sources are empty", async (source): Promise<void> => {
    put(".env.example", `${A}=`);
    put(".env", `${A}=${source === ".env" ? sentinel : ""}`);
    put(".env.local", `${A}=${source === ".env.local" ? sentinel : ""}`);
    vi.stubEnv(A, source === "process.env" ? sentinel : " ");
    expect(await scanner.run(context)).toEqual(expected("passed", "1 required variable is present"));
  });

  it("fails when only the example supplies a value", async (): Promise<void> => {
    put(".env.example", `${A}=${sentinel}`);
    expect(await scanner.run(context)).toEqual(expected("failed", "Missing 1 required variable", [A]));
  });

  it.each([false, true])("handles a declared name matching an object property (file supplied: %s)", async (supplied): Promise<void> => {
    const name = "toString";
    const original = Object.getOwnPropertyDescriptor(process.env, name);
    try {
      Reflect.deleteProperty(process.env, name);
      put(".env.example", `${name}=`);
      if (supplied) put(".env", `${name}=${sentinel}`);
      expect(await scanner.run(context)).toEqual(supplied
        ? expected("passed", "1 required variable is present")
        : expected("failed", "Missing 1 required variable", [name]));
    } finally {
      if (original !== undefined) Object.defineProperty(process.env, name, original);
      else Reflect.deleteProperty(process.env, name);
    }
  });

  it.each(["", "   ", "'  '", '"  "', '"\\n"'])("treats empty or whitespace-only file content %j as missing", async (value): Promise<void> => {
    put(".env.example", `${A}=`);
    put(".env", `${A}=${value}`);
    vi.stubEnv(A, " \t\n");
    expect(await scanner.run(context)).toEqual(expected("failed", "Missing 1 required variable", [A]));
  });

  it("returns every missing name sorted without exposing available names or values", async (): Promise<void> => {
    put(".env.example", [...keys].reverse().map((key): string => `${key}=${sentinel}`).join("\n"));
    put(".env", `UNRELATED_TEST_ONLY_NAME=${sentinel}`);
    const result = await scanner.run(context);
    expect(result).toEqual(expected("failed", "Missing 6 required variables", keys));
    expect(JSON.stringify(result)).not.toContain(sentinel);
    expect(result.details).not.toContain("UNRELATED_TEST_ONLY_NAME");
  });

  it.each(["", "# example-only comment\n\n"])("passes a contract with no required names (%j)", async (content): Promise<void> => {
    put(".env.example", content);
    expect(await scanner.run(context)).toEqual(expected("passed", "0 required variables are present"));
    expect(fileSystem.exists).toHaveBeenCalledTimes(1);
  });

  it("parses comments, blank lines, quoted values and duplicate required names", async (): Promise<void> => {
    put(".env.example", `# ignored\n\n${A}=first\n${B}=\n${A}=second\n`);
    put(".env", `${A}='test-only # quoted' # ignored\n${B}="test-only\\nmultiline"\n`);
    expect(await scanner.run(context)).toEqual(expected("passed", "2 required variables are present"));
  });

  it("uses dotenv's final declaration for duplicate available keys within a file", async (): Promise<void> => {
    put(".env.example", `${A}=`);
    put(".env", `${A}=${sentinel}\n${A}=`);
    expect(await scanner.run(context)).toEqual(expected("failed", "Missing 1 required variable", [A]));
  });

  it("checks literal presence without expanding references or validating placeholders", async (): Promise<void> => {
    put(".env.example", `${A}=placeholder\n${B}=`);
    put(".env", `${A}=placeholder\n${B}=\${SHIPCHECK_ENV_UNIT_CHARLIE}`);
    expect(await scanner.run(context)).toEqual(expected("passed", "2 required variables are present"));
  });

  it.each([".env.example", ".env", ".env.local"])("returns a safe error when %s cannot be read", async (filename): Promise<void> => {
    put(".env.example", `${A}=`);
    put(filename, `${A}=${sentinel}`);
    vi.mocked(fileSystem.readText).mockImplementation(async (path): Promise<string> => {
      if (path === join(cwd, filename)) throw Object.assign(new Error(sentinel), { code: "EACCES" });
      return `${A}=`;
    });
    const result = await scanner.run(context);
    expect(result).toEqual(expected("error", "Scanner could not complete"));
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it.each([".env.example", ".env", ".env.local"])("returns a safe error when checking %s fails", async (filename): Promise<void> => {
    put(".env.example", `${A}=`);
    vi.mocked(fileSystem.exists).mockImplementation(async (path): Promise<boolean> => {
      if (path === join(cwd, filename)) throw new Error(sentinel);
      return files.has(path);
    });
    expect(await scanner.run(context)).toEqual(expected("error", "Scanner could not complete"));
  });

  it.each([".env.example", ".env", ".env.local"])("handles %s disappearing between existence and read", async (filename): Promise<void> => {
    put(".env.example", `${A}=`);
    put(filename, `${A}=`);
    vi.stubEnv(A, sentinel);
    vi.mocked(fileSystem.readText).mockImplementation(async (path): Promise<string> => {
      if (path === join(cwd, filename)) throw Object.assign(new Error(sentinel), { code: "ENOENT" });
      return `${A}=`;
    });
    expect(await scanner.run(context)).toEqual(filename === ".env.example"
      ? expected("skipped", "No .env.example found") : expected("passed", "1 required variable is present"));
  });

  it("records duration from the injected clock", async (): Promise<void> => {
    vi.mocked(clock.now).mockReset().mockReturnValueOnce(1000).mockReturnValue(1042.4);
    expect(await scanner.run(context)).toEqual(expected("skipped", "No .env.example found", [], 42));
  });
});

describe("EnvScanner wiring", (): void => {
  it("resolves through ScannersModule with real constructor injection", async (): Promise<void> => {
    const moduleRef = await Test.createTestingModule({ imports: [ScannersModule] })
      .overrideProvider(FileSystem).useValue(fileSystem)
      .overrideProvider(Clock).useValue(clock)
      .compile();
    try {
      const injected = moduleRef.get(EnvScanner);
      expect(injected).toBeInstanceOf(EnvScanner);
      expect(Reflect.getMetadata("design:paramtypes", EnvScanner)).toEqual([FileSystem, Clock]);
      expect(await injected.run(context)).toEqual(expected("skipped", "No .env.example found"));
    } finally {
      await moduleRef.close();
    }
  });
});
