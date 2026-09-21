import { Buffer } from "node:buffer";
import { isAbsolute, win32 } from "node:path";

import { Injectable } from "@nestjs/common";
import { execa } from "execa";

import { FileSystem } from "./file-system.service.js";
import { ProcessExecutionError } from "./process-execution.error.js";
import { PROCESS_LIMITS } from "./process-limits.js";
import { ProcessStartError } from "./process-start.error.js";

import type { Result } from "execa";
import type { ProcessRequest } from "../common/types/process-request.type.js";
import type { ProcessResult } from "../common/types/process-result.type.js";

// Keep only the fields we inspect: Execa's full result also carries messages and
// recursive pipe metadata with stricter option-dependent optional properties.
type CapturedResult = Pick<Result<{ encoding: "buffer"; reject: false }>,
  "stdout" | "stderr" | "exitCode" | "failed" | "timedOut" | "isMaxBuffer"
  | "isCanceled" | "isTerminated" | "signal" | "code" | "cause">;
const START_ERROR_CODES = new Set(["ENOENT", "ENOTDIR", "EACCES", "EPERM", "ENOEXEC", "EAGAIN", "EMFILE", "ENFILE"]);

@Injectable()
export class ProcessRunner {
  public constructor(private readonly fileSystem: FileSystem) {}

  public async run(request: ProcessRequest): Promise<ProcessResult> {
    this.validate(request);
    const env = this.environment(request.env);
    const file = await this.executable(request.file, request.cwd, env);
    let result: CapturedResult;
    try {
      result = await execa(file, [...request.args], {
        cwd: request.cwd,
        env,
        extendEnv: false,
        timeout: request.timeoutMs,
        reject: false,
        shell: false,
        preferLocal: false,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        encoding: "buffer",
        buffer: true,
        stripFinalNewline: false,
        maxBuffer: PROCESS_LIMITS.MAX_OUTPUT_BYTES,
        verbose: "none",
        windowsHide: true,
        cleanup: true,
        killDescendants: true,
        forceKillAfterDelay: PROCESS_LIMITS.TERMINATION_GRACE_MS,
      });
    } catch (cause: unknown) {
      if (this.isStartFailure(cause)) throw new ProcessStartError({ cause });
      throw new ProcessExecutionError("adapter", { cause });
    }

    if (result.exitCode === undefined && this.isStartFailure(result)) {
      throw new ProcessStartError({ cause: result });
    }
    if (result.isMaxBuffer) throw new ProcessExecutionError("output_limit", { cause: result });
    if (result.code !== undefined || result.cause !== undefined) {
      throw new ProcessExecutionError("adapter", { cause: result });
    }
    if (result.timedOut) return this.decode(result, 1, true);
    if (result.isCanceled || result.isTerminated || result.signal !== undefined) {
      throw new ProcessExecutionError("signal", { cause: result });
    }
    if (!Number.isInteger(result.exitCode) || result.exitCode === undefined
      || result.exitCode < 0 || (result.failed && result.exitCode === 0)) {
      throw new ProcessExecutionError("adapter", { cause: result });
    }
    return this.decode(result, result.exitCode, false);
  }

  private validate(request: ProcessRequest): void {
    if (typeof request.file !== "string" || request.file.trim() === "" || request.file.includes("\0")
      || !Array.isArray(request.args) || request.args.some((arg): boolean => typeof arg !== "string" || arg.includes("\0"))
      || typeof request.cwd !== "string" || !isAbsolute(request.cwd) || request.cwd.includes("\0")
      || !Number.isInteger(request.timeoutMs) || request.timeoutMs <= 0 || request.timeoutMs > 2_147_483_647) {
      throw new ProcessExecutionError("invalid_request");
    }
    if (request.env !== undefined && Object.entries(request.env).some(([key, value]): boolean =>
      key.length === 0 || /[=\0]/.test(key) || (value !== undefined && (typeof value !== "string" || value.includes("\0"))))) {
      throw new ProcessExecutionError("invalid_request");
    }
  }

  private environment(overrides: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
    // Environment names such as constructor or __proto__ are ordinary keys.
    const env: NodeJS.ProcessEnv = Object.create(null);
    const windows = process.platform === "win32";
    // Match Node's first sorted case-insensitive match for inherited Windows keys.
    for (const key of Object.keys(process.env).sort()) {
      const normalized = windows ? key.toUpperCase() : key;
      if (!(normalized in env) && process.env[key] !== undefined) env[normalized] = process.env[key];
    }
    for (const [key, value] of Object.entries(overrides ?? {})) {
      const normalized = windows ? key.toUpperCase() : key;
      if (value === undefined) delete env[normalized];
      else env[normalized] = value;
    }
    return env;
  }

  private async executable(file: string, cwd: string, env: NodeJS.ProcessEnv): Promise<string> {
    if (process.platform !== "win32") return file;
    let resolved: string | undefined;
    try {
      resolved = await this.fileSystem.resolveWindowsExecutable(file, cwd, env);
    } catch (cause: unknown) {
      throw new ProcessStartError({ cause });
    }
    // Arbitrary shebang/batch files would widen the approved npm launcher exception.
    if (resolved === undefined || (!/\.(exe|com)$/i.test(resolved)
      && win32.basename(resolved).toLowerCase() !== "npm.cmd")) {
      throw new ProcessStartError();
    }
    return resolved;
  }

  private isStartFailure(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error
      && typeof error.code === "string" && START_ERROR_CODES.has(error.code);
  }

  private decode(result: CapturedResult, exitCode: number, timedOut: boolean): ProcessResult {
    if (!(result.stdout instanceof Uint8Array) || !(result.stderr instanceof Uint8Array)) {
      throw new ProcessExecutionError("adapter");
    }
    return {
      exitCode,
      stdout: Buffer.from(result.stdout).toString("utf8"),
      stderr: Buffer.from(result.stderr).toString("utf8"),
      timedOut,
    };
  }
}
