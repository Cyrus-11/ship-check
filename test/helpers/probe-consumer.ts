import { Injectable } from "@nestjs/common";

import { ProbeDependency } from "./probe-dependency.js";

@Injectable()
export class ProbeConsumer {
  public constructor(private readonly dependency: ProbeDependency) {}

  public readValue(): string {
    return this.dependency.value;
  }
}
