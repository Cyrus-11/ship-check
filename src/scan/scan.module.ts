import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { ReporterModule } from "../reporter/reporter.module.js";
import { ScannersModule } from "../scanners/scanners.module.js";
import { ScoringModule } from "../scoring/scoring.module.js";
import { ScanService } from "./scan.service.js";

@Module({
  imports: [InfrastructureModule, ScannersModule, ScoringModule, ReporterModule],
  providers: [ScanService],
  exports: [ScanService],
})
export class ScanModule {}
