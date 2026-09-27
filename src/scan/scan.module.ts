import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { ScannersModule } from "../scanners/scanners.module.js";
import { ScanService } from "./scan.service.js";

@Module({
  imports: [InfrastructureModule, ScannersModule],
  providers: [ScanService],
  exports: [ScanService],
})
export class ScanModule {}
