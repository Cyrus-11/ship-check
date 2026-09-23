import { Injectable } from "@nestjs/common";

import { SCANNER_WEIGHTS } from "../../common/constants/scoring.js";
import { Clock } from "../../infrastructure/clock.service.js";
import { PROCESS_LIMITS } from "../../infrastructure/process-limits.js";
import { ProcessExecutionError } from "../../infrastructure/process-execution.error.js";
import { ProcessRunner } from "../../infrastructure/process-runner.service.js";
import { ProcessStartError } from "../../infrastructure/process-start.error.js";

import type { Scanner } from "../../common/contracts/scanner.contract.js";
import type { ProcessResult } from "../../common/types/process-result.type.js";
import type { ScanContext } from "../../common/types/scan-context.type.js";
import type { ScanResult } from "../../common/types/scan-result.type.js";
import type { ScanStatus } from "../../common/types/scan-status.type.js";

@Injectable()
export class GitScanner implements Scanner {
  public readonly id = "git" as const;
  public readonly name = "Git";
  public readonly weight = SCANNER_WEIGHTS.git;

  public constructor(
    private readonly processRunner: ProcessRunner,
    private readonly clock: Clock,
  ) {}

  public async run(context: ScanContext): Promise<ScanResult> {
    const start = this.clock.now();
    try {
      return await this.evaluate(context, start);
    } catch (error: unknown) {
      // Spawn failures and unexpected adapter failures are the scanner's error cases.
      if (error instanceof ProcessStartError || error instanceof ProcessExecutionError) {
        return this.result("error", "Scanner could not complete", start);
      }
      throw error;
    }
  }

  private async evaluate(context: ScanContext, start: number): Promise<ScanResult> {
    const workTree = await this.git(["rev-parse", "--is-inside-work-tree"], context.cwd);
    if (workTree.timedOut) return this.result("error", "Scanner could not complete", start);
    if (workTree.exitCode !== 0) return this.result("failed", "Not a Git repository", start);

    const branch = await this.git(["branch", "--show-current"], context.cwd);
    if (branch.timedOut || branch.exitCode !== 0) {
      return this.result("error", "Scanner could not complete", start);
    }
    const branchName = branch.stdout.trim() === "" ? "detached HEAD" : branch.stdout.trim();

    const status = await this.git(["status", "--porcelain"], context.cwd);
    if (status.timedOut || status.exitCode !== 0) {
      return this.result("error", "Scanner could not complete", start);
    }
    const count = this.countChanges(status.stdout);
    if (count === 0) return this.result("passed", `Working tree is clean (${branchName})`, start);
    return this.result("failed", `Working tree has ${count} changed files`, start);
  }

  private async git(args: string[], cwd: string): Promise<ProcessResult> {
    return this.processRunner.run({ file: "git", args, cwd, timeoutMs: PROCESS_LIMITS.GIT_TIMEOUT_MS });
  }

  private countChanges(output: string): number {
    // Every non-empty porcelain line is one changed entry; paths are never inspected.
    return output.split(/\r?\n/).filter((line): boolean => line.trim() !== "").length;
  }

  private result(status: ScanStatus, summary: string, start: number): ScanResult {
    return {
      id: this.id,
      name: this.name,
      status,
      summary,
      details: [],
      durationMs: Math.round(this.clock.now() - start),
      weight: this.weight,
    };
  }
}
