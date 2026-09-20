import { CommandFactory } from "nest-commander";

import { AppModule } from "./app.module.js";
import { EXIT_CODE } from "./common/constants/exit-codes.js";
import { readPackageVersion } from "./common/package-version.js";

export async function bootstrap(
  readVersion: () => Promise<string> = readPackageVersion,
): Promise<void> {
  let parserExit: Error | undefined;
  let exitCode: number | undefined;

  try {
    await CommandFactory.run(AppModule, {
      cliName: "shipcheck",
      version: await readVersion(),
      usePlugins: false,
      logger: false,
      abortOnError: false,
      errorHandler: (error: Error): never => {
        // Returning here would let Commander call process.exit before Nest closes.
        parserExit = error;
        throw error;
      },
      serviceErrorHandler: (error: unknown): void => {
        // Only signals observed by the parser override are normal CLI exits.
        if (error !== parserExit || !(error instanceof Error)) {
          throw error;
        }

        const success = "code" in error &&
          (error.code === "commander.helpDisplayed" || error.code === "commander.version");
        exitCode = success ? EXIT_CODE.SUCCESS : EXIT_CODE.USAGE_OR_INTERNAL;
      },
      outputConfiguration: {
        outputError: (_message: string, write: (message: string) => void): void => {
          write("Shipcheck received invalid arguments. Run shipcheck --help for usage.\n");
        },
      },
    });

    // The factory has finished asynchronous shutdown. Future scan commands own
    // their own exit decision, so leave it alone when no parser exit occurred.
    if (exitCode !== undefined) {
      process.exitCode = exitCode;
    }
  } catch {
    process.stderr.write("Shipcheck could not complete the command.\n");
    process.exitCode = EXIT_CODE.USAGE_OR_INTERNAL;
  }
}
