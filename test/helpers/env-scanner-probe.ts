import "reflect-metadata";

import { join } from "node:path";

import { Test } from "@nestjs/testing";

import type { Type } from "@nestjs/common";
import type { EnvScanner as ScannerType } from "../../src/scanners/env/env.scanner.js";

const { ScannersModule }: { ScannersModule: Type<unknown> } = await import(
  new URL("../../../dist/scanners/scanners.module.js", import.meta.url).href
);
const { EnvScanner }: { EnvScanner: Type<ScannerType> } = await import(
  new URL("../../../dist/scanners/env/env.scanner.js", import.meta.url).href
);
const moduleRef = await Test.createTestingModule({ imports: [ScannersModule] }).compile();
try {
  const cwd = process.cwd();
  const before = { ...process.env };
  const result = await moduleRef.get(EnvScanner).run({
    cwd, projectName: "fixture", packageJsonPath: join(cwd, "package.json"), packageJson: {}, ci: false,
  });
  const environmentUnchanged = Object.keys(before).length === Object.keys(process.env).length
    && Object.entries(before).every(([key, value]): boolean => process.env[key] === value);
  process.stdout.write(JSON.stringify({ result, environmentUnchanged }));
} finally {
  await moduleRef.close();
}
