import { Command, CommandRunner, Option } from "nest-commander";

import { ScanService } from "../scan/scan.service.js";
import { throwParserExit } from "./parser-exit.js";
import { selectExitCode } from "./select-exit-code.js";

import type { ScanCommandOptions } from "./scan-command.options.js";

@Command({ name: "scan", description: "Run release-readiness checks" })
export class ScanCommand extends CommandRunner {
  public constructor(private readonly scanService: ScanService) {
    super();
  }

  public override setCommand(command: Parameters<CommandRunner["setCommand"]>[0]): this {
    super.setCommand(command);
    // Independently constructed child commands do not inherit these root settings.
    this.command.allowExcessArguments(false);
    this.command.exitOverride(throwParserExit);
    return this;
  }

  public async run(_inputs: string[], options: ScanCommandOptions = {}): Promise<void> {
    const ci = options.ci === true;
    const report = await this.scanService.scan({ ci });
    process.exitCode = selectExitCode(report, ci);
  }

  @Option({
    flags: "--ci",
    description: "Enforce the release gate through process exit codes",
  })
  public parseCi(): boolean {
    return true;
  }
}
