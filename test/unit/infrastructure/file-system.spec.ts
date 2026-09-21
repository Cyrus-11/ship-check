import "reflect-metadata";

import { access, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { FileSystem } from "../../../src/infrastructure/file-system.service.js";

import type { Stats } from "node:fs";

vi.mock("node:fs/promises", (): object => ({ access: vi.fn(), readFile: vi.fn(), stat: vi.fn() }));
const fs = new FileSystem();
const missing = Object.assign(new Error("test-only missing"), { code: "ENOENT" });

function fileStats(isFile: boolean): Stats {
  // Lookup consumes only isFile; the other OS metadata is irrelevant to this fake.
  return { isFile: (): boolean => isFile } as Stats;
}

afterEach((): void => { vi.unstubAllGlobals(); });

describe("FileSystem", (): void => {
  it("reads absolute files as UTF-8 and propagates read errors", async (): Promise<void> => {
    vi.mocked(readFile).mockResolvedValue("test-only café 🌱\n");
    await expect(fs.readText(resolve("fixture.txt"))).resolves.toBe("test-only café 🌱\n");
    expect(readFile).toHaveBeenCalledWith(resolve("fixture.txt"), "utf8");
    vi.mocked(readFile).mockRejectedValue(missing);
    await expect(fs.readText(resolve("fixture.txt"))).rejects.toBe(missing);
  });

  it("returns true for present paths and false only for ENOENT", async (): Promise<void> => {
    vi.mocked(access).mockResolvedValue(undefined);
    await expect(fs.exists(resolve("fixture"))).resolves.toBe(true);
    vi.mocked(access).mockRejectedValue(missing);
    await expect(fs.exists(resolve("fixture"))).resolves.toBe(false);
  });

  it.each(["EACCES", "EPERM", "ENOTDIR", "EIO"])("propagates %s instead of claiming absence", async (code): Promise<void> => {
    const error = Object.assign(new Error("test-only failure"), { code });
    vi.mocked(access).mockRejectedValue(error);
    await expect(fs.exists(resolve("fixture"))).rejects.toBe(error);
  });

  it("rejects relative project paths", async (): Promise<void> => {
    await expect(fs.readText("relative.txt")).rejects.toThrow(TypeError);
    await expect(fs.exists("relative.txt")).rejects.toThrow(TypeError);
    expect(readFile).not.toHaveBeenCalled();
    expect(access).not.toHaveBeenCalled();
  });

  it("uses cwd then PATH and PATHEXT order, including quoted directories", async (): Promise<void> => {
    vi.stubGlobal("process", { ...process, env: {} });
    vi.mocked(stat).mockRejectedValue(missing);
    vi.mocked(stat).mockResolvedValueOnce(fileStats(false));
    vi.mocked(stat).mockImplementation(async (path): Promise<Stats> => {
      if (path === "C:\\tools with spaces\\npm.CMD") return fileStats(true);
      throw missing;
    });
    await expect(fs.resolveWindowsExecutable("npm", "C:\\project", {
      Path: ';"";"C:\\tools with spaces";C:\\later', PathExt: ".EXE;.CMD",
    })).resolves.toBe("C:\\tools with spaces\\npm.CMD");
    expect(vi.mocked(stat).mock.calls.map(([path]): unknown => path)).toEqual([
      "C:\\project\\npm.EXE", "C:\\project\\npm.CMD",
      "C:\\tools with spaces\\npm.EXE", "C:\\tools with spaces\\npm.CMD",
    ]);
  });

  it("resolves explicit relative paths verbatim before extension candidates", async (): Promise<void> => {
    vi.mocked(stat).mockResolvedValue(fileStats(true));
    await expect(fs.resolveWindowsExecutable(".\\tools\\node.exe", "C:\\project", { PATH: "C:\\wrong" }))
      .resolves.toBe("C:\\project\\tools\\node.exe");
    expect(stat).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { PATHEXT: "" }])("uses standard extension fallback for %j", async (env): Promise<void> => {
    vi.stubGlobal("process", { ...process, env: {} });
    vi.mocked(stat).mockRejectedValueOnce(missing).mockResolvedValue(fileStats(true));
    await expect(fs.resolveWindowsExecutable("node", "C:\\project", env)).resolves.toBe("C:\\project\\node.EXE");
    expect(stat).toHaveBeenNthCalledWith(1, "C:\\project\\node.COM");
  });

  it.each(["effective", "inherited"])("honors %s NoDefaultCurrentDirectoryInExePath", async (source): Promise<void> => {
    const control = { NoDefaultCurrentDirectoryInExePath: "" };
    vi.stubGlobal("process", { ...process, env: source === "inherited" ? control : {} });
    vi.mocked(stat).mockResolvedValue(fileStats(true));
    await expect(fs.resolveWindowsExecutable("git", "C:\\project", {
      PATH: ';"";C:\\tools', PATHEXT: ".EXE", ...(source === "effective" ? control : {}),
    })).resolves.toBe("C:\\tools\\git.EXE");
    expect(stat).toHaveBeenCalledTimes(1);
  });

  it("does not find directories or missing commands", async (): Promise<void> => {
    vi.stubGlobal("process", { ...process, env: {} });
    vi.mocked(stat).mockResolvedValueOnce(fileStats(false)).mockRejectedValue(missing);
    await expect(fs.resolveWindowsExecutable("missing", "C:\\project", { PATHEXT: ".EXE;.CMD" })).resolves.toBeUndefined();
  });

  it("propagates executable metadata access failures", async (): Promise<void> => {
    const error = Object.assign(new Error("test-only permission"), { code: "EACCES" });
    vi.mocked(stat).mockRejectedValue(error);
    await expect(fs.resolveWindowsExecutable("C:\\tools\\git.exe", "C:\\project", {})).rejects.toBe(error);
  });
});
