import { selectExitCode } from "../../src/commands/select-exit-code.js";
import { SCAN_ORDER } from "../../src/common/constants/scan-order.js";
import { READINESS_THRESHOLDS, SCANNER_WEIGHTS } from "../../src/common/constants/scoring.js";

import type { Scanner } from "../../src/common/contracts/scanner.contract.js";
import type { PackageJson } from "../../src/common/types/package-json.type.js";
import type { ReadinessStatus } from "../../src/common/types/readiness-status.type.js";
import type { ScanContext } from "../../src/common/types/scan-context.type.js";
import type { ScannerId } from "../../src/common/types/scanner-id.type.js";
import type { ScanReport } from "../../src/common/types/scan-report.type.js";
import type { ScanResult } from "../../src/common/types/scan-result.type.js";
import type { ScanStatus } from "../../src/common/types/scan-status.type.js";

// tsc checks this uncalled function through tsconfig.test.json; Vitest never executes it.
export function verifyDomainContracts(): void {
  const minimalPackage: PackageJson = {};
  const packageJson: PackageJson = {
    name: "typecheck-fixture",
    scripts: { build: "fixture-build", test: "fixture-test" },
  };
  const blankPackage: PackageJson = { name: "", scripts: { build: "", test: "" } };
  const context: ScanContext = {
    cwd: "/fixture",
    projectName: "typecheck-fixture",
    packageJsonPath: "/fixture/package.json",
    packageJson,
    ci: false,
  };
  const result: ScanResult = {
    id: "git",
    name: "Git",
    status: "passed",
    summary: "Typecheck fixture",
    details: [],
    durationMs: 0,
    weight: SCANNER_WEIGHTS.git,
  };
  const scanner: Scanner = {
    id: result.id,
    name: result.name,
    weight: result.weight,
    run: async (_context: ScanContext): Promise<ScanResult> => result,
  };
  const report: ScanReport = {
    projectName: context.projectName,
    cwd: context.cwd,
    results: [result],
    score: 100,
    status: "READY",
    gatePassed: true,
    durationMs: 0,
  };
  const statuses: ScanStatus[] = ["passed", "failed", "skipped", "error"];
  const readiness: ReadinessStatus[] = ["READY", "REVIEW", "NOT_READY"];
  const run: Promise<ScanResult> = scanner.run(context);
  const exit: number = selectExitCode(report, context.ci);

  // @ts-expect-error A fifth scanner is outside the v0.1 ID union.
  const invalidId: ScannerId = "lint";
  // @ts-expect-error Scanner outcomes must use the closed status union.
  const invalidStatus: ScanStatus = "warning";
  // @ts-expect-error Display labels do not belong in internal readiness status.
  const invalidReadiness: ReadinessStatus = "NOT READY";

  const { durationMs, ...withoutDuration } = result;
  const { weight, ...withoutWeight } = result;
  const { gatePassed, ...withoutGate } = report;
  // @ts-expect-error Duration is required on every scanner result.
  const missingDuration: ScanResult = withoutDuration;
  // @ts-expect-error Weight is required on every scanner result.
  const missingWeight: ScanResult = withoutWeight;
  // @ts-expect-error A full report must include its gate decision.
  const missingGate: ScanReport = withoutGate;
  // @ts-expect-error The gate-only shell projection is not a complete report.
  const incompleteReport: ScanReport = { gatePassed: false };
  // @ts-expect-error Scanner implementations must return a promise.
  const synchronousRun: Scanner["run"] = (_context: ScanContext): ScanResult => result;
  // @ts-expect-error Scanner identity cannot be reassigned through the contract.
  scanner.id = "build";
  // @ts-expect-error Scanner names are immutable identity fields.
  scanner.name = "Changed";
  // @ts-expect-error Scanner weight is immutable through the contract.
  scanner.weight = 50;
  // @ts-expect-error A scanner cannot select a different context working directory.
  context.cwd = "/another-fixture";
  // @ts-expect-error Scan mode is fixed in the shared context.
  context.ci = true;
  // @ts-expect-error Project metadata cannot be replaced through the context.
  context.packageJson = minimalPackage;
  // @ts-expect-error Package name is readonly in the validated projection.
  context.packageJson.name = "changed";
  if (context.packageJson.scripts !== undefined) {
    // @ts-expect-error Build scripts cannot be changed through the shared context.
    context.packageJson.scripts.build = "changed";
    // @ts-expect-error Test scripts cannot be changed through the shared context.
    context.packageJson.scripts.test = "changed";
  }

  // @ts-expect-error Unknown JSON must be narrowed before becoming package metadata.
  const invalidName: PackageJson = { name: 42 };
  // @ts-expect-error The build script must be a string when present.
  const invalidBuild: PackageJson = { scripts: { build: true } };
  // @ts-expect-error The test script must be a string when present.
  const invalidTest: PackageJson = { scripts: { test: [] } };
  // @ts-expect-error The canonical execution tuple is readonly.
  SCAN_ORDER.push("git");
  // @ts-expect-error The weight map must cover every canonical scanner ID.
  const missingScannerWeight: Record<ScannerId, number> = { git: 25, build: 25, test: 25 };
  // @ts-expect-error The weight map cannot add unsupported scanners.
  const extraScannerWeight = { ...SCANNER_WEIGHTS, lint: 25 } satisfies Record<ScannerId, number>;
  // @ts-expect-error Frozen scoring policy is readonly at compile time too.
  SCANNER_WEIGHTS.git = 50;
  // @ts-expect-error Readiness thresholds cannot be reassigned.
  READINESS_THRESHOLDS.READY = 80;
}
