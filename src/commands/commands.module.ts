import { Module } from "@nestjs/common";

import { ScanModule } from "../scan/scan.module.js";
import { RootCommand } from "./root.command.js";
import { ScanCommand } from "./scan.command.js";

@Module({ imports: [ScanModule], providers: [RootCommand, ScanCommand] })
export class CommandsModule {}
