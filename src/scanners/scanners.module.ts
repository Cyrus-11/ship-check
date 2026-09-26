import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { BuildScanner } from "./build/build.scanner.js";
import { EnvScanner } from "./env/env.scanner.js";
import { GitScanner } from "./git/git.scanner.js";
import { TestScanner } from "./test/test.scanner.js";

@Module({
  imports: [InfrastructureModule],
  providers: [GitScanner, BuildScanner, TestScanner, EnvScanner],
  exports: [GitScanner, BuildScanner, TestScanner, EnvScanner],
})
export class ScannersModule {}
