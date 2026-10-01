import { stripVTControlCharacters } from "node:util";

import { Inject, Injectable } from "@nestjs/common";
import chalk from "chalk";
import ora from "ora";

import { OUTPUT_LABELS, OUTPUT_SPACING, OUTPUT_SYMBOLS, SCANNER_NAMES, SPINNER_TEXT, STATUS_LABELS } from "./output-tokens.js";
import { REPORTER_CAPABILITIES, REPORTER_OUTPUT, REPORTER_VERSION } from "./reporter.tokens.js";

import type { OnModuleDestroy } from "@nestjs/common";
import type { ScanReport } from "../common/types/scan-report.type.js";
import type { ScanResult } from "../common/types/scan-result.type.js";
import type { ScannerId } from "../common/types/scanner-id.type.js";
import type { ReporterCapabilities } from "./reporter-capabilities.type.js";
import type { ReporterOutput } from "./reporter-output.type.js";

@Injectable()
export class TerminalReporter implements OnModuleDestroy {
  private spinner: ora.Ora | undefined;

  public constructor(
    @Inject(REPORTER_OUTPUT) private readonly output: ReporterOutput,
    @Inject(REPORTER_CAPABILITIES) private readonly capabilities: ReporterCapabilities,
    @Inject(REPORTER_VERSION) private readonly version: string,
  ) {}

  public startScanner(id: ScannerId, options: { ci: boolean }): void {
    this.stopScanner();
    if (!this.colorEnabled(options) || this.capabilities.testMode) return;
    this.spinner = ora({
      text: SPINNER_TEXT[id], stream: this.output.stdout,
      isEnabled: true, discardStdin: false,
    });
    try {
      this.spinner.start();
    } catch (error: unknown) {
      this.stopScanner();
      throw error;
    }
  }

  public stopScanner(): void {
    this.spinner?.stop();
    this.spinner = undefined;
  }

  public onModuleDestroy(): void {
    this.stopScanner();
  }

  public async report(report: ScanReport, options: { ci: boolean }): Promise<void> {
    this.stopScanner();
    const style = new chalk.Instance({ level: this.colorEnabled(options) ? 1 : 0 });
    const counts = { passed: 0, failed: 0, skipped: 0 };
    const rows: string[] = [];
    for (const result of report.results) {
      counts[result.status === "error" ? "failed" : result.status]++;
      const symbol = OUTPUT_SYMBOLS[result.status];
      const coloredSymbol = result.status === "passed" ? style.green(symbol)
        : result.status === "skipped" ? style.yellow(symbol) : style.red(symbol);
      const name = SCANNER_NAMES[result.id].padEnd(OUTPUT_SPACING.scannerNameWidth);
      rows.push(`${coloredSymbol} ${name} ${this.displayText(result.summary)}`);
      rows.push(...this.details(result).map((line): string => style.dim(line)));
    }
    const status = STATUS_LABELS[report.status];
    const coloredStatus = report.status === "READY" ? style.green(status)
      : report.status === "REVIEW" ? style.yellow(status) : style.red(status);
    const gate = report.gatePassed ? style.green(OUTPUT_LABELS.gatePassed) : style.red(OUTPUT_LABELS.gateFailed);
    const lines = [
      style.cyan(`${OUTPUT_LABELS.product} v${this.displayText(this.version)}`),
      ...this.gap(OUTPUT_SPACING.headingGapLines),
      `${OUTPUT_LABELS.project} ${this.displayText(report.projectName)}`,
      `${OUTPUT_LABELS.path} ${style.dim(this.displayText(report.cwd))}`,
      ...this.gap(OUTPUT_SPACING.metadataGapLines),
      ...rows,
      ...this.gap(OUTPUT_SPACING.resultsGapLines),
      `${OUTPUT_LABELS.checks} ${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped`,
      `${OUTPUT_LABELS.score} ${report.score}/100`,
      `${OUTPUT_LABELS.status} ${coloredStatus}`,
      `${OUTPUT_LABELS.gate} ${gate}`,
    ];
    await this.output.writeStdout(`${lines.join("\n")}\n`);
  }

  private colorEnabled(options: { ci: boolean }): boolean {
    return this.capabilities.stdoutIsTTY && this.capabilities.noColor === undefined && !options.ci;
  }

  private displayText(text: string): string {
    return stripVTControlCharacters(text).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, " ");
  }

  private details(result: ScanResult): string[] {
    // Only missing environment names are public detail data in v0.1.
    if (result.id !== "env" || result.status !== "failed") return [];
    const lines = result.details.slice(0, OUTPUT_SPACING.maxVisibleDetails).map((name): string => {
      const line = `${" ".repeat(OUTPUT_SPACING.detailIndentSpaces)}- ${this.displayText(name)}`;
      const points = Array.from(line);
      return points.length <= OUTPUT_SPACING.maxDetailLength ? line
        : `${points.slice(0, OUTPUT_SPACING.maxDetailLength - 1).join("")}…`;
    });
    const remaining = result.details.length - OUTPUT_SPACING.maxVisibleDetails;
    if (remaining > 0) lines.push(`${" ".repeat(OUTPUT_SPACING.detailIndentSpaces)}- …and ${remaining} more`);
    return lines;
  }

  private gap(lines: number): string[] {
    return Array.from({ length: lines }, (): string => "");
  }
}
