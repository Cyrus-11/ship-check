import { performance } from "node:perf_hooks";

import { Injectable } from "@nestjs/common";

@Injectable()
export class Clock {
  public now(): number {
    return performance.now();
  }
}
