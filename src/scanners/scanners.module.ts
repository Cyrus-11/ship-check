import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { BuildScanner } from "./build/build.scanner.js";
import { GitScanner } from "./git/git.scanner.js";

@Module({
  imports: [InfrastructureModule],
  providers: [GitScanner, BuildScanner],
  exports: [GitScanner, BuildScanner],
})
export class ScannersModule {}
