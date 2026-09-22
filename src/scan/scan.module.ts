import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { ScanService } from "./scan.service.js";

@Module({
  imports: [InfrastructureModule],
  providers: [ScanService],
  exports: [ScanService],
})
export class ScanModule {}
