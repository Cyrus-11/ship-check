import "reflect-metadata";

import { basename, join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectDiscoveryError } from "../../../src/scan/project-discovery.error.js";
import { ScanService } from "../../../src/scan/scan.service.js";

import type { Scanner } from "../../../src/common/contracts/scanner.contract.js";
import type { ScanContext } from "../../../src/common/types/scan-context.type.js";
import type { ScanReport } from "../../../src/common/types/scan-report.type.js";
import type { ScanResult } from "../../../src/common/types/scan-result.type.js";
import type { ScanStatus } from "../../../src/common/types/scan-status.type.js";
import type { ScannerId } from "../../../src/common/types/scanner-id.type.js";
import type { Clock } from "../../../src/infrastructure/clock.service.js";
import type { FileSystem } from "../../../src/infrastructure/file-system.service.js";
import type { TerminalReporter } from "../../../src/reporter/terminal-reporter.service.js";
import type { ScoringService } from "../../../src/scoring/scoring.service.js";

type FakeScanner = Scanner & { run: ReturnType<typeof vi.fn<Scanner["run"]>> };

const readText = vi.fn<FileSystem["readText"]>();
const now = vi.fn<Clock["now"]>();
const calculate = vi.fn<ScoringService["calculate"]>();
const startScanner = vi.fn<TerminalReporter["startScanner"]>();
const stopScanner = vi.fn<TerminalReporter["stopScanner"]>();
const report = vi.fn<TerminalReporter["report"]>();
const events: string[] = [];
const names: Record<ScannerId, string> = { git: "Git", build: "Build", test: "Tests", env: "Environment" };
const readiness: Pick<ScanReport, "score" | "status" | "gatePassed"> = { score: 50, status: "NOT_READY", gatePassed: false };

function result(id: ScannerId, status: ScanStatus = "passed"): ScanResult {
  return { id, name: names[id], status, summary: `test-only ${id} ${status}`, details: [], durationMs: 3, weight: 25 };
}

function scanner(id: ScannerId, run: Scanner["run"] = async (): Promise<ScanResult> => result(id)): FakeScanner {
  const fake = vi.fn<Scanner["run"]>(async (context: ScanContext): Promise<ScanResult> => {
    events.push(`run:${id}`);
    try {
      return await run(context);
    } finally {
      events.push(`settled:${id}`);
    }
  });
  return { id, name: names[id], weight: 25, run: fake };
}

// The service uses only these ports of its collaborators.
function serviceWith(scanners: Scanner[] = []): ScanService {
  return new ScanService(
    { readText } as unknown as FileSystem,
    scanners,
    { now } as unknown as Clock,
    { calculate } as unknown as ScoringService,
    { startScanner, stopScanner, report } as unknown as TerminalReporter,
  );
}

const service = serviceWith();

const cwd = resolve("test-only-project");
const manifestPath = join(cwd, "package.json");
const coded = (code: string): Error => Object.assign(new Error("test-only-secret-cause"), { code });

beforeEach((): void => {
  events.length = 0;
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  let tick = 0;
  now.mockImplementation((): number => (tick += 10.4));
  calculate.mockImplementation((): typeof readiness => { events.push("score"); return readiness; });
  startScanner.mockImplementation((id, options): void => { events.push(`start:${id}:${options.ci}`); });
  stopScanner.mockImplementation((): void => { events.push("stop"); });
  report.mockImplementation(async (): Promise<void> => { events.push("report"); });
});

afterEach((): void => { vi.restoreAllMocks(); });

describe("ScanService discovery", (): void => {
  it("reads only <cwd>/package.json once and builds an immutable context", async (): Promise<void> => {
    readText.mockResolvedValue('{"name":"acme-api","scripts":{"build":"tsc","test":"vitest"}}');

    await expect(service.discover({ ci: true })).resolves.toEqual({
      cwd,
      projectName: "acme-api",
      packageJsonPath: manifestPath,
      packageJson: { name: "acme-api", scripts: { build: "tsc", test: "vitest" } },
      ci: true,
    });
    expect(readText).toHaveBeenCalledExactlyOnceWith(manifestPath);
  });

  it("omits non-string and non-object script fields", async (): Promise<void> => {
    readText.mockResolvedValue('{"name":"x","scripts":{"build":123,"test":"vitest"}}');
    expect((await service.discover({ ci: false })).packageJson).toEqual({
      name: "x", scripts: { test: "vitest" },
    });

    readText.mockResolvedValue('{"name":"x","scripts":"nope"}');
    expect((await service.discover({ ci: false })).packageJson).toEqual({ name: "x" });
  });

  it.each([
    { manifest: '{"scripts":{}}', label: "a missing name" },
    { manifest: '{"name":"   "}', label: "a blank name" },
    { manifest: '{"name":123}', label: "a non-string name" },
  ])("uses the directory basename for $label", async ({ manifest }): Promise<void> => {
    readText.mockResolvedValue(manifest);
    expect((await service.discover({ ci: false })).projectName).toBe(basename(cwd));
  });

  it("preserves a blank name string in the projection while falling back for display", async (): Promise<void> => {
    readText.mockResolvedValue('{"name":"   "}');
    const context = await service.discover({ ci: false });
    expect(context.packageJson).toEqual({ name: "   " });
    expect(context.projectName).toBe(basename(cwd));
  });

  it("fails as not_found when package.json is absent", async (): Promise<void> => {
    readText.mockRejectedValue(coded("ENOENT"));
    await expect(service.discover({ ci: false })).rejects.toMatchObject({
      name: "ProjectDiscoveryError", reason: "not_found",
    });
  });

  it("fails as unreadable for other filesystem errors without leaking the cause", async (): Promise<void> => {
    readText.mockRejectedValue(coded("EACCES"));
    const failure = await service.discover({ ci: false }).catch((error: unknown): unknown => error);
    expect(failure).toBeInstanceOf(ProjectDiscoveryError);
    expect((failure as ProjectDiscoveryError).reason).toBe("unreadable");
    expect((failure as ProjectDiscoveryError).report).not.toContain("test-only-secret-cause");
  });

  it("fails as invalid for malformed JSON", async (): Promise<void> => {
    readText.mockResolvedValue("not json {");
    await expect(service.discover({ ci: false })).rejects.toMatchObject({ reason: "invalid" });
  });

  it.each(['"just a string"', "42", "true", "null", "[1,2,3]"])(
    "fails as invalid when the root is %s", async (manifest: string): Promise<void> => {
      readText.mockResolvedValue(manifest);
      await expect(service.discover({ ci: false })).rejects.toMatchObject({ reason: "invalid" });
    },
  );
});

describe("ScanService orchestration", (): void => {
  const registry = (): FakeScanner[] => [scanner("git"), scanner("build"), scanner("test"), scanner("env")];

  beforeEach((): void => {
    readText.mockResolvedValue('{"name":"acme-api","scripts":{"build":"tsc"}}');
  });

  it("discovers once, runs the registry in order, scores, reports, and returns the same report", async (): Promise<void> => {
    const scanners = registry();
    const returned = await serviceWith(scanners).scan({ ci: true });

    expect(readText).toHaveBeenCalledExactlyOnceWith(manifestPath);
    const context = scanners[0]?.run.mock.calls[0]?.[0];
    expect(context).toEqual({
      cwd, projectName: "acme-api", packageJsonPath: manifestPath,
      packageJson: { name: "acme-api", scripts: { build: "tsc" } }, ci: true,
    });
    for (const fake of scanners) expect(fake.run).toHaveBeenCalledExactlyOnceWith(context);
    expect(events).toEqual([
      "start:git:true", "run:git", "settled:git", "stop",
      "start:build:true", "run:build", "settled:build", "stop",
      "start:test:true", "run:test", "settled:test", "stop",
      "start:env:true", "run:env", "settled:env", "stop",
      "score", "report",
    ]);
    const results = [result("git"), result("build"), result("test"), result("env")];
    expect(calculate).toHaveBeenCalledExactlyOnceWith(results);
    // Clock readings: scan start, four scanner starts, then the end after scoring.
    expect(returned).toEqual({ projectName: "acme-api", cwd, results, ...readiness, durationMs: 52 });
    expect(report).toHaveBeenCalledExactlyOnceWith(returned, { ci: true });
    expect(report.mock.calls[0]?.[0]).toBe(returned);
    expect(calculate.mock.calls[0]?.[0]).toBe(returned.results);
  });

  it("forwards local mode to progress and reporting", async (): Promise<void> => {
    const returned = await serviceWith(registry()).scan({ ci: false });
    expect(events.filter((event): boolean => event.startsWith("start:"))).toEqual([
      "start:git:false", "start:build:false", "start:test:false", "start:env:false",
    ]);
    expect(report).toHaveBeenCalledExactlyOnceWith(returned, { ci: false });
  });

  it("does not start the next scanner until the previous one settles", async (): Promise<void> => {
    let finish: (value: ScanResult) => void = (): never => { throw new Error("Deferred scanner has not started"); };
    const pending = new Promise<ScanResult>((resolve): void => { finish = resolve; });
    const later = scanner("build");
    const scan = serviceWith([scanner("git", (): Promise<ScanResult> => pending), later]).scan({ ci: false });

    await vi.waitFor((): void => { expect(events).toContain("run:git"); });
    await new Promise<void>((resolve): void => { setImmediate(resolve); });
    expect(later.run).not.toHaveBeenCalled();
    expect(calculate).not.toHaveBeenCalled();
    expect(events).not.toContain("stop");

    finish(result("git"));
    await scan;
    expect(events.indexOf("stop")).toBeLessThan(events.indexOf("start:build:false"));
    expect(later.run).toHaveBeenCalledOnce();
  });

  it("preserves failed, skipped, and error results unchanged and keeps scanning", async (): Promise<void> => {
    const outcomes = [result("git", "failed"), result("build", "error"), result("test", "skipped"), result("env")];
    const scanners = outcomes.map((outcome): FakeScanner => scanner(outcome.id, async (): Promise<ScanResult> => outcome));

    const returned = await serviceWith(scanners).scan({ ci: false });

    expect(returned.results).toHaveLength(4);
    returned.results.forEach((actual, index): void => { expect(actual).toBe(outcomes[index]); });
    expect(calculate).toHaveBeenCalledOnce();
  });

  it.each([
    { label: "an Error", thrown: (): unknown => new Error("test-only-secret-throw") },
    { label: "a non-Error value", thrown: (): unknown => ({ secret: "test-only-secret-throw" }) },
  ])("turns $label thrown by one scanner into a safe error result", async ({ thrown }): Promise<void> => {
    const throwing = scanner("build", async (): Promise<ScanResult> => { throw thrown(); });
    const scanners = [scanner("git"), throwing, scanner("test"), scanner("env")];

    const returned = await serviceWith(scanners).scan({ ci: false });

    expect(returned.results.map((entry): ScannerId => entry.id)).toEqual(["git", "build", "test", "env"]);
    // The failed scanner started at the third reading and was caught at the fourth.
    expect(returned.results[1]).toEqual({
      id: "build", name: "Build", status: "error", summary: "Scanner could not complete",
      details: [], durationMs: 10, weight: 25,
    });
    expect(scanners[2]?.run).toHaveBeenCalledOnce();
    expect(scanners[3]?.run).toHaveBeenCalledOnce();
    expect(startScanner).toHaveBeenCalledTimes(4);
    expect(stopScanner).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(returned)).not.toContain("test-only-secret");
    expect(JSON.stringify(report.mock.calls)).not.toContain("test-only-secret");
  });

  it("uses the provider's own identity and weight for a synthesized error", async (): Promise<void> => {
    const odd: Scanner = { id: "env", name: "Environment", weight: 7, run: async (): Promise<ScanResult> => { throw new Error("x"); } };
    const returned = await serviceWith([odd]).scan({ ci: false });
    expect(returned.results).toEqual([expect.objectContaining({ id: "env", name: "Environment", weight: 7, status: "error" })]);
  });

  it("runs no scanner, progress, scoring, or report when discovery fails", async (): Promise<void> => {
    readText.mockRejectedValue(coded("ENOENT"));
    const scanners = registry();
    await expect(serviceWith(scanners).scan({ ci: true })).rejects.toBeInstanceOf(ProjectDiscoveryError);
    for (const fake of scanners) expect(fake.run).not.toHaveBeenCalled();
    expect(startScanner).not.toHaveBeenCalled();
    expect(calculate).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("propagates a scoring failure without reporting", async (): Promise<void> => {
    const failure = new Error("test-only-scoring-failure");
    calculate.mockImplementation((): never => { throw failure; });
    await expect(serviceWith(registry()).scan({ ci: false })).rejects.toBe(failure);
    expect(report).not.toHaveBeenCalled();
  });

  it("propagates a reporting failure instead of returning a report", async (): Promise<void> => {
    const failure = new Error("test-only-report-failure");
    report.mockRejectedValue(failure);
    await expect(serviceWith(registry()).scan({ ci: true })).rejects.toBe(failure);
  });

  it("waits for reporting to finish before returning", async (): Promise<void> => {
    let written: () => void = (): never => { throw new Error("Deferred report has not started"); };
    report.mockImplementation((): Promise<void> => new Promise<void>((resolve): void => { written = resolve; }));
    let settled = false;
    const scan = serviceWith(registry()).scan({ ci: false }).then((value): ScanReport => { settled = true; return value; });

    await vi.waitFor((): void => { expect(report).toHaveBeenCalledOnce(); });
    await new Promise<void>((resolve): void => { setImmediate(resolve); });
    expect(settled).toBe(false);
    written();
    await scan;
    expect(settled).toBe(true);
  });

  it("stops the pipeline when progress cannot start", async (): Promise<void> => {
    const failure = new Error("test-only-progress-failure");
    startScanner.mockImplementation((): never => { throw failure; });
    const scanners = registry();
    await expect(serviceWith(scanners).scan({ ci: false })).rejects.toBe(failure);
    for (const fake of scanners) expect(fake.run).not.toHaveBeenCalled();
    expect(calculate).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("propagates a clock failure rather than labelling it a scanner error", async (): Promise<void> => {
    const failure = new Error("test-only-clock-failure");
    now.mockImplementation((): never => { throw failure; });
    await expect(serviceWith(registry()).scan({ ci: false })).rejects.toBe(failure);
    expect(report).not.toHaveBeenCalled();
  });

  it("scores an empty registry once and still reports", async (): Promise<void> => {
    const returned = await serviceWith([]).scan({ ci: false });
    expect(calculate).toHaveBeenCalledExactlyOnceWith([]);
    expect(returned.results).toEqual([]);
    expect(report).toHaveBeenCalledOnce();
  });
});
