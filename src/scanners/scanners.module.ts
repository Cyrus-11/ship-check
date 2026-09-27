import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { BuildScanner } from "./build/build.scanner.js";
import { EnvScanner } from "./env/env.scanner.js";
import { GitScanner } from "./git/git.scanner.js";
import { SCANNERS } from "./scanner.tokens.js";
import { TestScanner } from "./test/test.scanner.js";

import type { FactoryProvider } from "@nestjs/common";
import type { Scanner } from "../common/contracts/scanner.contract.js";

const scannerRegistryProvider: FactoryProvider<Scanner[]> = {
  provide: SCANNERS,
  inject: [GitScanner, BuildScanner, TestScanner, EnvScanner],
  // Registry order is product behavior; reuse the injected singleton instances.
  useFactory: (git: GitScanner, build: BuildScanner, test: TestScanner, env: EnvScanner): Scanner[] =>
    [git, build, test, env],
};

@Module({
  imports: [InfrastructureModule],
  providers: [GitScanner, BuildScanner, TestScanner, EnvScanner, scannerRegistryProvider],
  exports: [GitScanner, BuildScanner, TestScanner, EnvScanner, SCANNERS],
})
export class ScannersModule {}
