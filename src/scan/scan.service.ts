import { Injectable } from "@nestjs/common";

import type { ScanShellReport } from "./scan-shell-report.type.js";

@Injectable()
export class ScanService {
  public async scan(_options: { ci: boolean }): Promise<ScanShellReport> {
    // A shell that has not evaluated any checks cannot approve a release.
    return { gatePassed: false };
  }
}
