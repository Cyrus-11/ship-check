import { Module } from "@nestjs/common";

import { CommandsModule } from "./commands/commands.module.js";

@Module({ imports: [CommandsModule] })
export class AppModule {}
