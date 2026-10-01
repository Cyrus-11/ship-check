import "reflect-metadata";

import { setTimeout } from "node:timers/promises";

import { Test } from "@nestjs/testing";

import type { Scanner } from "../../src/common/contracts/scanner.contract.js";
import type { ScanContext } from "../../src/common/types/scan-context.type.js";
import type { ScanReport } from "../../src/common/types/scan-report.type.js";
import type { ScanResult } from "../../src/common/types/scan-result.type.js";
import type { ScanStatus } from "../../src/common/types/scan-status.type.js";
import type { ScannerId } from "../../src/common/types/scanner-id.type.js";

// All runtime tokens/classes come from dist so symbol and provider identities agree.
const { ScanModule }: typeof import("../../src/scan/scan.module.js") = await import(
  new URL("../../../dist/scan/scan.module.js", import.meta.url).href
);
const { ScanService }: typeof import("../../src/scan/scan.service.js") = await import(
  new URL("../../../dist/scan/scan.service.js", import.meta.url).href
);
const { SCANNERS }: typeof import("../../src/scanners/scanner.tokens.js") = await import(
  new URL("../../../dist/scanners/scanner.tokens.js", import.meta.url).href
);
const { TerminalReporter }: typeof import("../../src/reporter/terminal-reporter.service.js") = await import(
  new URL("../../../dist/reporter/terminal-reporter.service.js", import.meta.url).href
);

const events: string[] = [];
const contexts: ScanContext[] = [];

// Controlled scanners never invoke Git or npm; the build entry throws a sentinel.
function controlled(id: ScannerId, name: string, status: ScanStatus | "throw", summary: string): Scanner {
  return {
    id, name, weight: 25,
    run: async (context: ScanContext): Promise<ScanResult> => {
      events.push(`run:${id}`);
      contexts.push(context);
      await setTimeout(20);
      events.push(`settled:${id}`);
      if (status === "throw") throw new Error("test-only-secret-scanner-throw");
      return { id, name, status, summary, details: [], durationMs: 20, weight: 25 };
    },
  };
}

const moduleRef = await Test.createTestingModule({ imports: [ScanModule] })
  .overrideProvider(SCANNERS).useValue([
    controlled("git", "Git", "passed", "Working tree is clean (main)"),
    controlled("build", "Build", "throw", "unused"),
    controlled("test", "Tests", "failed", "npm test failed"),
    controlled("env", "Environment", "skipped", "No .env.example found"),
  ])
  .compile();
try {
  const reporter = moduleRef.get(TerminalReporter);
  const render = reporter.report.bind(reporter);
  let rendered: ScanReport | undefined;
  reporter.report = async (report, options): Promise<void> => {
    events.push("report");
    rendered = report;
    await render(report, options);
  };

  const report = await moduleRef.get(ScanService).scan({ ci: process.argv.includes("--ci") });
  process.stdout.write(`${JSON.stringify({
    events,
    sameContext: contexts.length === 4 && contexts.every((context): boolean => context === contexts[0]),
    sameReport: rendered === report,
    results: report.results.map((result): string => `${result.id}:${result.status}:${result.summary}`),
    score: report.score, status: report.status, gatePassed: report.gatePassed,
    durationIsWhole: Number.isInteger(report.durationMs) && report.durationMs >= 0,
  })}\n`);
} finally {
  await moduleRef.close();
}
