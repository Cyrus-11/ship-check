import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { BuildScanner } from "./build/build.scanner.js";
import { GitScanner } from "./git/git.scanner.js";
import { TestScanner } from "./test/test.scanner.js";

@Module({
  imports: [InfrastructureModule],
  providers: [GitScanner, BuildScanner, TestScanner],
  exports: [GitScanner, BuildScanner, TestScanner],
})
export class ScannersModule {}
