import { Injectable } from "@nestjs/common";

@Injectable()
export class ProbeDependency {
  public readonly value = "dependency resolved";
}
