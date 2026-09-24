import { Injectable } from "@nestjs/common";

import { SCANNER_WEIGHTS } from "../../common/constants/scoring.js";
import { Clock } from "../../infrastructure/clock.service.js";
import { PROCESS_LIMITS } from "../../infrastructure/process-limits.js";
import { ProcessExecutionError } from "../../infrastructure/process-execution.error.js";
import { ProcessRunner } from "../../infrastructure/process-runner.service.js";
import { ProcessStartError } from "../../infrastructure/process-start.error.js";

import type { Scanner } from "../../common/contracts/scanner.contract.js";
import type { ScanContext } from "../../common/types/scan-context.type.js";
import type { ScanResult } from "../../common/types/scan-result.type.js";
import type { ScanStatus } from "../../common/types/scan-status.type.js";

@Injectable()
export class BuildScanner implements Scanner {
  public readonly id = "build" as const;
  public readonly name = "Build";
  public readonly weight = SCANNER_WEIGHTS.build;

  public constructor(
    private readonly processRunner: ProcessRunner,
    private readonly clock: Clock,
  ) {}

  public async run(context: ScanContext): Promise<ScanResult> {
    const start = this.clock.now();
    try {
      return await this.evaluate(context, start);
    } catch (error: unknown) {
      // A repo-owned build that overruns the output cap is a build failure, not a Shipcheck error.
      if (error instanceof ProcessExecutionError && error.reason === "output_limit") {
        return this.result("failed", "npm run build failed", start);
      }
      // Spawn failures and unexpected adapter failures are the scanner's error cases.
      if (error instanceof ProcessStartError || error instanceof ProcessExecutionError) {
        return this.result("error", "Scanner could not complete", start);
      }
      throw error;
    }
  }

  private async evaluate(context: ScanContext, start: number): Promise<ScanResult> {
    const script = context.packageJson.scripts?.build;
    if (script === undefined || script.trim() === "") {
      return this.result("failed", "package.json has no build script", start);
    }

    const build = await this.processRunner.run({
      file: "npm",
      args: ["run", "build"],
      cwd: context.cwd,
      timeoutMs: PROCESS_LIMITS.BUILD_TIMEOUT_MS,
    });
    // Unlike the Git scanner, a build timeout is a failed check, not an error.
    if (build.timedOut) {
      const seconds = PROCESS_LIMITS.BUILD_TIMEOUT_MS / 1000;
      return this.result("failed", `npm run build timed out after ${seconds}s`, start);
    }
    if (build.exitCode !== 0) return this.result("failed", "npm run build failed", start);
    return this.result("passed", "npm run build passed", start);
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
