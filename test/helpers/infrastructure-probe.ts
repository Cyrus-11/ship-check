import "reflect-metadata";

import { Test } from "@nestjs/testing";

import type { Type } from "@nestjs/common";
import type { ProcessRunner as RunnerType } from "../../src/infrastructure/process-runner.service.js";

const { InfrastructureModule }: { InfrastructureModule: Type<unknown> } = await import(
  new URL("../../../dist/infrastructure/infrastructure.module.js", import.meta.url).href
);
const { ProcessRunner }: { ProcessRunner: Type<RunnerType> } = await import(
  new URL("../../../dist/infrastructure/process-runner.service.js", import.meta.url).href
);
const moduleRef = await Test.createTestingModule({ imports: [InfrastructureModule] }).compile();
try {
  const result = await moduleRef.get(ProcessRunner).run({
    file: process.execPath, args: ["-e", "process.stdout.write('production adapter')"],
    cwd: process.cwd(), timeoutMs: 5_000,
  });
  process.stdout.write(JSON.stringify(result));
} finally {
  await moduleRef.close();
}
