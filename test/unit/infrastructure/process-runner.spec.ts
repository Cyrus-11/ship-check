import "reflect-metadata";

import { resolve } from "node:path";

import { execa } from "execa";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileSystem } from "../../../src/infrastructure/file-system.service.js";
import { ProcessRunner } from "../../../src/infrastructure/process-runner.service.js";
import { ProcessStartError } from "../../../src/infrastructure/process-start.error.js";
import { ProcessExecutionError } from "../../../src/infrastructure/process-execution.error.js";

import type { ProcessRequest } from "../../../src/common/types/process-request.type.js";

vi.mock("execa", (): object => ({ execa: vi.fn() }));

const execute = vi.mocked(execa);
const fileSystem = new FileSystem();
const runner = new ProcessRunner(fileSystem);
const request: ProcessRequest = { file: process.execPath, args: ["fixture.js"], cwd: resolve("."), timeoutMs: 500 };

// Only awaiting the result is part of this boundary; these partial fakes omit child/IPC methods.
function result(overrides: Record<string, unknown> = {}): ReturnType<typeof execa> {
  return Promise.resolve({
    exitCode: 0, failed: false, stdout: Buffer.from("out\n"), stderr: Buffer.from("err\n"),
    timedOut: false, isMaxBuffer: false, isCanceled: false, isTerminated: false, ...overrides,
  }) as unknown as ReturnType<typeof execa>;
}

beforeEach((): void => {
  vi.spyOn(fileSystem, "resolveWindowsExecutable").mockResolvedValue(process.execPath);
  execute.mockReturnValue(result());
});
afterEach((): void => { vi.unstubAllGlobals(); });

describe("ProcessRunner", (): void => {
  it.each([0, 7])("preserves exit %i and captured text without trimming", async (exitCode): Promise<void> => {
    execute.mockReturnValue(result({ exitCode, failed: exitCode !== 0 }));
    await expect(runner.run(request)).resolves.toEqual({ exitCode, stdout: "out\n", stderr: "err\n", timedOut: false });
    expect(execute).toHaveBeenCalledWith(expect.any(String), ["fixture.js"], expect.objectContaining({
      cwd: request.cwd, timeout: 500, shell: false, preferLocal: false, reject: false,
      stdin: "ignore", stdout: "pipe", stderr: "pipe", encoding: "buffer", buffer: true,
      stripFinalNewline: false, maxBuffer: 1_000_000, verbose: "none", extendEnv: false,
      cleanup: true, windowsHide: true, killDescendants: true, forceKillAfterDelay: 5_000,
    }));
  });

  it("maps timeout without a child exit to the documented sentinel", async (): Promise<void> => {
    execute.mockReturnValue(result({ exitCode: undefined, failed: true, timedOut: true, isTerminated: true }));
    await expect(runner.run(request)).resolves.toEqual({ exitCode: 1, stdout: "out\n", stderr: "err\n", timedOut: true });
  });

  it.each(["ENOENT", "EACCES", "ENOTDIR", "ENOEXEC"])("maps resolved %s failures to safe start errors", async (code): Promise<void> => {
    execute.mockReturnValue(result({ exitCode: undefined, code, message: "test-only private output" }));
    await expect(runner.run(request)).rejects.toThrow(ProcessStartError);
  });

  it.each([
    [{ isMaxBuffer: true, exitCode: 0, timedOut: true }, "output_limit"],
    [{ exitCode: undefined, isTerminated: true, signal: "SIGTERM" }, "signal"],
    [{ exitCode: undefined, isCanceled: true }, "signal"],
    [{ exitCode: undefined }, "adapter"],
    [{ code: "EPIPE", timedOut: true }, "adapter"],
    [{ cause: new Error("test-only private output") }, "adapter"],
    [{ failed: true, exitCode: 0 }, "adapter"],
    [{ stdout: undefined }, "adapter"],
  ])("rejects operational failure %j as %s", async (overrides, reason): Promise<void> => {
    execute.mockReturnValue(result(overrides));
    await expect(runner.run(request)).rejects.toMatchObject({ name: "ProcessExecutionError", reason,
      message: "Unable to complete the requested process." });
  });

  it("wraps rejected start failures and unknown rejections without leaking messages", async (): Promise<void> => {
    execute.mockImplementation((): never => { throw Object.assign(new Error("test-only private args"), { code: "ENOENT" }); });
    await expect(runner.run(request)).rejects.toMatchObject({ name: "ProcessStartError", message: "Unable to start the requested process." });
    execute.mockImplementation((): never => { throw new Error("test-only private output"); });
    await expect(runner.run(request)).rejects.toMatchObject({ reason: "adapter", message: "Unable to complete the requested process." });
  });

  it.each([
    { file: " " }, { file: "bad\0file" }, { args: ["bad\0arg"] }, { cwd: "relative" },
    { timeoutMs: 0 }, { timeoutMs: -1 }, { timeoutMs: Infinity }, { timeoutMs: 0.5 },
    { timeoutMs: 2_147_483_648 }, { env: { "bad=key": "test-only" } },
  ])("rejects invalid request %j before launch", async (overrides): Promise<void> => {
    await expect(runner.run({ ...request, ...overrides })).rejects.toMatchObject({ reason: "invalid_request" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("merges overrides with inherited variables without changing inputs", async (): Promise<void> => {
    const inherited = { Path: "original", Keep: "test-only", CI: "old", Remove: "old" };
    vi.stubGlobal("process", { ...process, platform: "win32", env: inherited });
    const env = Object.freeze({ PATH: "override", CI: "true", remove: undefined });
    const args = ["literal & value"];
    await runner.run({ ...request, env, args });
    expect(execute).toHaveBeenCalledWith(expect.any(String), args, expect.objectContaining({
      env: { PATH: "override", KEEP: "test-only", CI: "true" },
    }));
    expect(inherited).toEqual({ Path: "original", Keep: "test-only", CI: "old", Remove: "old" });
    expect(env).toEqual({ PATH: "override", CI: "true", remove: undefined });
    expect(args).toEqual(["literal & value"]);
  });

  it("keeps differently cased POSIX variables distinct", async (): Promise<void> => {
    vi.stubGlobal("process", { ...process, platform: "linux", env: { Path: "original", CI: "old", constructor: "test-only" } });
    await runner.run({ ...request, env: { PATH: "new", CI: undefined } });
    expect(execute).toHaveBeenCalledWith(request.file, request.args, expect.objectContaining({ env: { Path: "original", PATH: "new", constructor: "test-only" } }));
    expect(fileSystem.resolveWindowsExecutable).not.toHaveBeenCalled();
  });

  it.each([undefined, "C:\\tools\\other.cmd", "C:\\tools\\script.js"])("rejects missing or unsupported Windows executable %s", async (file): Promise<void> => {
    vi.stubGlobal("process", { ...process, platform: "win32" });
    vi.mocked(fileSystem.resolveWindowsExecutable).mockResolvedValue(file);
    await expect(runner.run(request)).rejects.toThrow(ProcessStartError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("allows the resolved Windows npm launcher with separate arguments", async (): Promise<void> => {
    vi.stubGlobal("process", { ...process, platform: "win32" });
    vi.mocked(fileSystem.resolveWindowsExecutable).mockResolvedValue("C:\\tools with spaces\\NPM.CMD");
    await runner.run({ ...request, file: "npm", args: ["run", "build"] });
    expect(execute).toHaveBeenCalledWith("C:\\tools with spaces\\NPM.CMD", ["run", "build"], expect.objectContaining({ shell: false }));
  });

  it("maps lookup permission failures without launching", async (): Promise<void> => {
    vi.stubGlobal("process", { ...process, platform: "win32" });
    vi.mocked(fileSystem.resolveWindowsExecutable).mockRejectedValue(new Error("test-only private path"));
    await expect(runner.run(request)).rejects.toThrow(ProcessStartError);
    expect(execute).not.toHaveBeenCalled();
  });
});
