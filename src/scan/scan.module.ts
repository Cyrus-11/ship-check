import { Module } from "@nestjs/common";

import { ScanService } from "./scan.service.js";

@Module({ providers: [ScanService], exports: [ScanService] })
export class ScanModule {}
