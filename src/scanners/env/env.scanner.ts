import { join } from "node:path";

import { Injectable } from "@nestjs/common";
import { parse } from "dotenv";

import { SCANNER_WEIGHTS } from "../../common/constants/scoring.js";
import { Clock } from "../../infrastructure/clock.service.js";
import { FileSystem } from "../../infrastructure/file-system.service.js";

import type { Scanner } from "../../common/contracts/scanner.contract.js";
import type { ScanContext } from "../../common/types/scan-context.type.js";
import type { ScanResult } from "../../common/types/scan-result.type.js";
import type { ScanStatus } from "../../common/types/scan-status.type.js";

@Injectable()
export class EnvScanner implements Scanner {
  public readonly id = "env" as const;
  public readonly name = "Environment";
  public readonly weight = SCANNER_WEIGHTS.env;

  public constructor(
    private readonly fileSystem: FileSystem,
    private readonly clock: Clock,
  ) {}

  public async run(context: ScanContext): Promise<ScanResult> {
    const start = this.clock.now();
    try {
      return await this.evaluate(context, start);
    } catch {
      // Filesystem/parser errors may contain values or paths; expose neither.
      return this.result("error", "Scanner could not complete", start);
    }
  }

  private async evaluate(context: ScanContext, start: number): Promise<ScanResult> {
    const required = await this.requiredNames(join(context.cwd, ".env.example"));
    if (required === undefined) return this.result("skipped", "No .env.example found", start);
    if (required.length === 0) return this.result("passed", "0 required variables are present", start);

    const missing = new Set(required.filter((name): boolean =>
      !Object.hasOwn(process.env, name) || !this.isPresent(process.env[name])));
    for (const filename of [".env", ".env.local"]) {
      // Union presence rather than merging values: an empty source cannot hide a present one.
      for (const name of await this.presentNames(join(context.cwd, filename))) missing.delete(name);
    }

    if (missing.size > 0) {
      const summary = `Missing ${missing.size} required variable${missing.size === 1 ? "" : "s"}`;
      return this.result("failed", summary, start, [...missing].sort());
    }
    const summary = required.length === 1 ? "1 required variable is present"
      : `${required.length} required variables are present`;
    return this.result("passed", summary, start);
  }

  private async requiredNames(path: string): Promise<string[] | undefined> {
    const content = await this.readIfPresent(path);
    return content === undefined ? undefined : Object.keys(parse(content));
  }

  private async presentNames(path: string): Promise<string[]> {
    const content = await this.readIfPresent(path);
    if (content === undefined) return [];
    // Keep parsed values inside this call; only names survive presence evaluation.
    return Object.entries(parse(content))
      .filter(([, value]): boolean => this.isPresent(value))
      .map(([name]): string => name);
  }

  private async readIfPresent(path: string): Promise<string | undefined> {
    try {
      if (!(await this.fileSystem.exists(path))) return undefined;
      return await this.fileSystem.readText(path);
    } catch (error: unknown) {
      // A file can disappear after the existence check.
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    }
  }

  private isPresent(value: string | undefined): boolean {
    return value !== undefined && value.trim().length > 0;
  }

  private result(status: ScanStatus, summary: string, start: number, details: string[] = []): ScanResult {
    return {
      id: this.id,
      name: this.name,
      status,
      summary,
      details,
      durationMs: Math.round(this.clock.now() - start),
      weight: this.weight,
    };
  }
}
