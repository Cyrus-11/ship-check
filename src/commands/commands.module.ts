import { Module } from "@nestjs/common";

import { RootCommand } from "./root.command.js";

@Module({ providers: [RootCommand] })
export class CommandsModule {}
