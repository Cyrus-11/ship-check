import "reflect-metadata";

import { basename, join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectDiscoveryError } from "../../../src/scan/project-discovery.error.js";
import { ScanService } from "../../../src/scan/scan.service.js";

import type { FileSystem } from "../../../src/infrastructure/file-system.service.js";

const readText = vi.fn<FileSystem["readText"]>();
// The service depends only on the readText port of FileSystem.
const service = new ScanService({ readText } as unknown as FileSystem);

const cwd = resolve("test-only-project");
const manifestPath = join(cwd, "package.json");
const coded = (code: string): Error => Object.assign(new Error("test-only-secret-cause"), { code });

beforeEach((): void => {
  readText.mockReset();
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
});

afterEach((): void => { vi.restoreAllMocks(); });

describe("ScanService discovery", (): void => {
  it("reads only <cwd>/package.json once and builds an immutable context", async (): Promise<void> => {
    readText.mockResolvedValue('{"name":"acme-api","scripts":{"build":"tsc","test":"vitest"}}');

    await expect(service.discover({ ci: true })).resolves.toEqual({
      cwd,
      projectName: "acme-api",
      packageJsonPath: manifestPath,
      packageJson: { name: "acme-api", scripts: { build: "tsc", test: "vitest" } },
      ci: true,
    });
    expect(readText).toHaveBeenCalledExactlyOnceWith(manifestPath);
  });

  it("omits non-string and non-object script fields", async (): Promise<void> => {
    readText.mockResolvedValue('{"name":"x","scripts":{"build":123,"test":"vitest"}}');
    expect((await service.discover({ ci: false })).packageJson).toEqual({
      name: "x", scripts: { test: "vitest" },
    });

    readText.mockResolvedValue('{"name":"x","scripts":"nope"}');
    expect((await service.discover({ ci: false })).packageJson).toEqual({ name: "x" });
  });

  it.each([
    { manifest: '{"scripts":{}}', label: "a missing name" },
    { manifest: '{"name":"   "}', label: "a blank name" },
    { manifest: '{"name":123}', label: "a non-string name" },
  ])("uses the directory basename for $label", async ({ manifest }): Promise<void> => {
    readText.mockResolvedValue(manifest);
    expect((await service.discover({ ci: false })).projectName).toBe(basename(cwd));
  });

  it("preserves a blank name string in the projection while falling back for display", async (): Promise<void> => {
    readText.mockResolvedValue('{"name":"   "}');
    const context = await service.discover({ ci: false });
    expect(context.packageJson).toEqual({ name: "   " });
    expect(context.projectName).toBe(basename(cwd));
  });

  it("fails as not_found when package.json is absent", async (): Promise<void> => {
    readText.mockRejectedValue(coded("ENOENT"));
    await expect(service.discover({ ci: false })).rejects.toMatchObject({
      name: "ProjectDiscoveryError", reason: "not_found",
    });
  });

  it("fails as unreadable for other filesystem errors without leaking the cause", async (): Promise<void> => {
    readText.mockRejectedValue(coded("EACCES"));
    const failure = await service.discover({ ci: false }).catch((error: unknown): unknown => error);
    expect(failure).toBeInstanceOf(ProjectDiscoveryError);
    expect((failure as ProjectDiscoveryError).reason).toBe("unreadable");
    expect((failure as ProjectDiscoveryError).report).not.toContain("test-only-secret-cause");
  });

  it("fails as invalid for malformed JSON", async (): Promise<void> => {
    readText.mockResolvedValue("not json {");
    await expect(service.discover({ ci: false })).rejects.toMatchObject({ reason: "invalid" });
  });

  it.each(['"just a string"', "42", "true", "null", "[1,2,3]"])(
    "fails as invalid when the root is %s", async (manifest: string): Promise<void> => {
      readText.mockResolvedValue(manifest);
      await expect(service.discover({ ci: false })).rejects.toMatchObject({ reason: "invalid" });
    },
  );
});

describe("ScanService scan shell", (): void => {
  it("discovers before returning the temporary gate result", async (): Promise<void> => {
    readText.mockResolvedValue('{"name":"x"}');
    await expect(service.scan({ ci: true })).resolves.toEqual({ gatePassed: false });
    expect(readText).toHaveBeenCalledExactlyOnceWith(manifestPath);
  });

  it("propagates a discovery failure instead of approving a release", async (): Promise<void> => {
    readText.mockRejectedValue(coded("ENOENT"));
    await expect(service.scan({ ci: false })).rejects.toBeInstanceOf(ProjectDiscoveryError);
  });
});
