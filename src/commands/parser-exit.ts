import { EXIT_CODE } from "../common/constants/exit-codes.js";

export class ParserExitSignal extends Error {
  public readonly exitCode: number;

  public constructor(cause: Error) {
    super("Command parser completed", { cause });
    const success = "code" in cause &&
      (cause.code === "commander.helpDisplayed" || cause.code === "commander.version");
    this.exitCode = success ? EXIT_CODE.SUCCESS : EXIT_CODE.USAGE_OR_INTERNAL;
  }
}

export function throwParserExit(error: Error): never {
  // Returning from an exit override would let Commander terminate before cleanup.
  throw new ParserExitSignal(error);
}
