import { Injectable } from "@nestjs/common";

import type { ScanReport } from "../common/types/scan-report.type.js";

@Injectable()
export class ScanService {
  public async scan(_options: { ci: boolean }): Promise<Pick<ScanReport, "gatePassed">> {
    // A shell that has not evaluated any checks cannot approve a release.
    return { gatePassed: false };
  }
}
