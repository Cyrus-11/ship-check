import { CommandRunner, RootCommand as RootCommandDecorator } from "nest-commander";

@RootCommandDecorator({
  name: "shipcheck",
  description: "Check whether a Node.js project is ready to ship",
})
export class RootCommand extends CommandRunner {
  public override setCommand(command: Parameters<CommandRunner["setCommand"]>[0]): this {
    super.setCommand(command);
    this.command.allowExcessArguments(false);
    this.command.addHelpCommand(false);
    return this;
  }

  public async run(): Promise<void> {
    this.command.outputHelp();
  }
}
