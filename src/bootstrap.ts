import { CommandFactory } from "nest-commander";

import { AppModule } from "./app.module.js";
import { ParserExitSignal, throwParserExit } from "./commands/parser-exit.js";
import { EXIT_CODE } from "./common/constants/exit-codes.js";
import { readPackageVersion } from "./common/package-version.js";

export async function bootstrap(
  readVersion: () => Promise<string> = readPackageVersion,
): Promise<void> {
  let exitCode: number | undefined;

  try {
    await CommandFactory.run(AppModule, {
      cliName: "shipcheck",
      version: await readVersion(),
      usePlugins: false,
      logger: false,
      abortOnError: false,
      errorHandler: throwParserExit,
      serviceErrorHandler: (error: unknown): void => {
        // Only signals from our root/child parser overrides are normal CLI exits.
        if (!(error instanceof ParserExitSignal)) {
          throw error;
        }

        exitCode = error.exitCode;
      },
      outputConfiguration: {
        outputError: (_message: string, write: (message: string) => void): void => {
          write("Shipcheck received invalid arguments. Run shipcheck --help for usage.\n");
        },
      },
    });

    // The factory has finished asynchronous shutdown. Scan commands own
    // their own exit decision, so leave it alone when no parser exit occurred.
    if (exitCode !== undefined) {
      process.exitCode = exitCode;
    }
  } catch {
    process.stderr.write("Shipcheck could not complete the command.\n");
    process.exitCode = EXIT_CODE.USAGE_OR_INTERNAL;
  }
}
