import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { GitScanner } from "./git/git.scanner.js";

@Module({
  imports: [InfrastructureModule],
  providers: [GitScanner],
  exports: [GitScanner],
})
export class ScannersModule {}
