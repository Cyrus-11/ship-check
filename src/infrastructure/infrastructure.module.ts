import { Module } from "@nestjs/common";

import { Clock } from "./clock.service.js";
import { FileSystem } from "./file-system.service.js";
import { ProcessRunner } from "./process-runner.service.js";

@Module({
  providers: [ProcessRunner, FileSystem, Clock],
  exports: [ProcessRunner, FileSystem, Clock],
})
export class InfrastructureModule {}
