import "reflect-metadata";

import { setTimeout } from "node:timers/promises";

import { Test } from "@nestjs/testing";

import { reporterFixture } from "./reporter-fixture.js";

// Load classes from the same production tree to preserve Nest token identity.
const { ReporterModule }: typeof import("../../src/reporter/reporter.module.js") = await import(
  new URL("../../../dist/reporter/reporter.module.js", import.meta.url).href
);
const { TerminalReporter }: typeof import("../../src/reporter/terminal-reporter.service.js") = await import(
  new URL("../../../dist/reporter/terminal-reporter.service.js", import.meta.url).href
);
const moduleRef = await Test.createTestingModule({ imports: [ReporterModule] }).compile();
try {
  const reporter = moduleRef.get(TerminalReporter);
  const options = { ci: process.argv.includes("--ci") };
  if (process.argv.includes("--progress")) {
    for (const id of ["git", "build", "test", "env"] as const) {
      reporter.startScanner(id, options);
      await setTimeout(150);
    }
  }
  if (!process.argv.includes("--silent")) await reporter.report(reporterFixture(process.argv[2]), options);
} finally {
  await moduleRef.close();
}
