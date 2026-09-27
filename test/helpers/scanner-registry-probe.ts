import "reflect-metadata";

import { Test } from "@nestjs/testing";

import type { Scanner } from "../../src/common/contracts/scanner.contract.js";

// All runtime tokens/classes come from dist so symbol and provider identities agree.
const { ScanModule }: typeof import("../../src/scan/scan.module.js") = await import(
  new URL("../../../dist/scan/scan.module.js", import.meta.url).href
);
const { SCANNERS }: typeof import("../../src/scanners/scanner.tokens.js") = await import(
  new URL("../../../dist/scanners/scanner.tokens.js", import.meta.url).href
);
const { GitScanner }: typeof import("../../src/scanners/git/git.scanner.js") = await import(
  new URL("../../../dist/scanners/git/git.scanner.js", import.meta.url).href
);
const { BuildScanner }: typeof import("../../src/scanners/build/build.scanner.js") = await import(
  new URL("../../../dist/scanners/build/build.scanner.js", import.meta.url).href
);
const { TestScanner }: typeof import("../../src/scanners/test/test.scanner.js") = await import(
  new URL("../../../dist/scanners/test/test.scanner.js", import.meta.url).href
);
const { EnvScanner }: typeof import("../../src/scanners/env/env.scanner.js") = await import(
  new URL("../../../dist/scanners/env/env.scanner.js", import.meta.url).href
);

const moduleRef = await Test.createTestingModule({ imports: [ScanModule] }).compile();
try {
  const scanners = moduleRef.get<Scanner[]>(SCANNERS);
  const concrete = [moduleRef.get(GitScanner), moduleRef.get(BuildScanner),
    moduleRef.get(TestScanner), moduleRef.get(EnvScanner)];
  process.stdout.write(JSON.stringify({
    ids: scanners.map((scanner): string => scanner.id),
    weights: scanners.map((scanner): number => scanner.weight),
    sameInstances: scanners.every((scanner, index): boolean => scanner === concrete[index]),
    sameRegistry: scanners === moduleRef.get<Scanner[]>(SCANNERS),
  }));
} finally {
  await moduleRef.close();
}
