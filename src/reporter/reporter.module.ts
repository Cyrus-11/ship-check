import { Module } from "@nestjs/common";

import { readPackageVersion } from "../common/package-version.js";
import { REPORTER_CAPABILITIES, REPORTER_OUTPUT, REPORTER_VERSION } from "./reporter.tokens.js";
import { TerminalReporter } from "./terminal-reporter.service.js";
import { writeOutput } from "./write-output.js";

import type { ReporterCapabilities } from "./reporter-capabilities.type.js";
import type { ReporterOutput } from "./reporter-output.type.js";

@Module({
  providers: [
    TerminalReporter,
    { provide: REPORTER_VERSION, useFactory: readPackageVersion },
    {
      provide: REPORTER_CAPABILITIES,
      useFactory: (): ReporterCapabilities => ({
        stdoutIsTTY: process.stdout.isTTY === true,
        noColor: process.env.NO_COLOR,
        testMode: process.env.VITEST === "true" || process.env.NODE_ENV === "test",
      }),
    },
    {
      provide: REPORTER_OUTPUT,
      useFactory: (): ReporterOutput => ({
        stdout: process.stdout,
        writeStdout: (text): Promise<void> => writeOutput(process.stdout, text),
        writeStderr: (text): Promise<void> => writeOutput(process.stderr, text),
      }),
    },
  ],
  exports: [TerminalReporter],
})
export class ReporterModule {}
