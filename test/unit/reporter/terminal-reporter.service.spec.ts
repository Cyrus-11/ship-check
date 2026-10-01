import "reflect-metadata";

import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

import chalk from "chalk";
import ora from "ora";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TerminalReporter } from "../../../src/reporter/terminal-reporter.service.js";
import { reporterFixture } from "../../helpers/reporter-fixture.js";

import type { ScanReport } from "../../../src/common/types/scan-report.type.js";
import type { ReporterCapabilities } from "../../../src/reporter/reporter-capabilities.type.js";

vi.mock("ora", (): object => ({ default: vi.fn() }));

const start = vi.fn();
const stop = vi.fn();

beforeEach((): void => {
  // Ora is the package boundary: tests never start an animation or timer.
  vi.mocked(ora).mockReturnValue({ start, stop } as unknown as ora.Ora);
});

function setup(capabilities: Partial<ReporterCapabilities> = {}): {
  reporter: TerminalReporter;
  stdout: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;
  stderr: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;
} {
  const stdout = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  const stderr = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  return {
    reporter: new TerminalReporter({ stdout: process.stdout, writeStdout: stdout, writeStderr: stderr },
      { stdoutIsTTY: false, noColor: undefined, testMode: true, ...capabilities }, "0.1.0"),
    stdout, stderr,
  };
}

function envDetails(report: ScanReport, names: string[]): void {
  const result = report.results.find((entry): boolean => entry.id === "env");
  if (!result) throw new Error("Missing fixture environment result");
  result.status = "failed";
  result.details = names;
}

describe("TerminalReporter", (): void => {
  it.each(["ready", "review", "not-ready", "skip", "error"])("renders the canonical %s report", async (kind): Promise<void> => {
    const { reporter, stdout, stderr } = setup();
    await reporter.report(reporterFixture(kind), { ci: false });
    expect(stdout).toHaveBeenCalledTimes(1);
    const snapshot = fileURLToPath(new URL(`../../../../test/fixtures/reporter/${kind}.txt`, import.meta.url));
    await expect(stdout.mock.calls[0]?.[0]).toMatchFileSnapshot(snapshot);
    expect(stderr).not.toHaveBeenCalled();
    expect(ora).not.toHaveBeenCalled();
  });

  it.each([0, 1, 5, 6, 12])("shows at most five of %i names plus an accurate overflow indicator", async (count): Promise<void> => {
    const { reporter, stdout } = setup();
    const report = reporterFixture("review");
    envDetails(report, Array.from({ length: count }, (_, i): string => `NAME_${i}`));
    await reporter.report(report, { ci: true });
    const lines = stdout.mock.calls[0]?.[0].split("\n").filter((line): boolean => line.startsWith("  - "));
    expect(lines).toEqual([
      ...Array.from({ length: Math.min(count, 5) }, (_, i): string => `  - NAME_${i}`),
      ...(count > 5 ? [`  - …and ${count - 5} more`] : []),
    ]);
  });

  it.each([159, 160, 161])("bounds a %i-character detail including prefix and ellipsis", async (length): Promise<void> => {
    const { reporter, stdout } = setup();
    const report = reporterFixture("review");
    envDetails(report, ["𐐀".repeat(length - 4)]);
    await reporter.report(report, { ci: false });
    const detail = stdout.mock.calls[0]?.[0].split("\n").find((line): boolean => line.startsWith("  - ")) ?? "";
    expect(Array.from(detail)).toHaveLength(Math.min(length, 160));
    expect(detail).toBe(`  - ${"𐐀".repeat(length > 160 ? 155 : length - 4)}${length > 160 ? "…" : ""}`);
  });

  it.each(["ready", "skip", "error"])("ignores non-public detail payloads in %s results", async (kind): Promise<void> => {
    const { reporter, stdout } = setup();
    const report = reporterFixture(kind);
    for (const result of report.results) {
      result.details = ["SENTINEL_VALUE", "SENTINEL_STACK", "SENTINEL_CHANGED_PATH"];
      Object.assign(result, { stdout: "SENTINEL_COMMAND_OUTPUT", stderr: "SENTINEL_ERROR_OUTPUT" });
    }
    await reporter.report(report, { ci: false });
    expect(stdout.mock.calls[0]?.[0]).not.toContain("SENTINEL");
  });

  it("removes terminal sequences and replaces controls before formatting", async (): Promise<void> => {
    const { reporter, stdout } = setup();
    const report = reporterFixture("review");
    report.projectName = "\u001b[31mproject\u001b[0m\nname\r\t";
    report.cwd = "/workspace/\u001b]8;;https://example.invalid\u0007path\u001b]8;;\u0007";
    const first = report.results[0];
    if (!first) throw new Error("Missing first result");
    first.summary = "Safe\u0000\u0085\u2028\u2029summary";
    envDetails(report, ["NAME\n\r\t\u001b[2JEND"]);
    await reporter.report(report, { ci: true });
    const output = stdout.mock.calls[0]?.[0] ?? "";
    expect(output).toContain("Project: project name  \nPath: /workspace/path\n");
    expect(output).toContain("Safe    summary\n");
    expect(output).toContain("  - NAME   END\n");
    expect(output).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/u);
    expect(output.split("\n")).toHaveLength(16);
  });

  it("preserves result order, canonical names, supplied policy and frozen inputs", async (): Promise<void> => {
    const { reporter, stdout } = setup();
    const report = reporterFixture("review");
    report.results.reverse();
    for (const result of report.results) {
      result.name = "Ignored noncanonical display name";
      Object.freeze(result.details);
      Object.freeze(result);
    }
    Object.freeze(report.results);
    Object.freeze(report);
    const before = structuredClone(report);
    await reporter.report(report, { ci: false });
    const output = stdout.mock.calls[0]?.[0] ?? "";
    expect(output.indexOf("Environment")).toBeLessThan(output.indexOf("Git"));
    expect(output).not.toContain("Ignored");
    expect(output).toContain("Release score: 75/100\nStatus: REVIEW\nRelease gate: FAILED\n");
    expect(report).toEqual(before);
  });

  it.each([
    { stdoutIsTTY: false, noColor: undefined, ci: false, testMode: false, color: false, spinner: false },
    { stdoutIsTTY: true, noColor: undefined, ci: true, testMode: false, color: false, spinner: false },
    { stdoutIsTTY: true, noColor: "", ci: false, testMode: false, color: false, spinner: false },
    { stdoutIsTTY: true, noColor: "1", ci: false, testMode: false, color: false, spinner: false },
    { stdoutIsTTY: true, noColor: undefined, ci: false, testMode: true, color: true, spinner: false },
    { stdoutIsTTY: true, noColor: undefined, ci: false, testMode: false, color: true, spinner: true },
  ])("honors capabilities $stdoutIsTTY/$noColor/$ci/$testMode", async (capabilities): Promise<void> => {
    const { reporter, stdout, stderr } = setup(capabilities);
    reporter.startScanner("git", { ci: capabilities.ci });
    expect(stdout).not.toHaveBeenCalled();
    expect(ora).toHaveBeenCalledTimes(capabilities.spinner ? 1 : 0);
    await reporter.report(reporterFixture(), { ci: capabilities.ci });
    expect((stdout.mock.calls[0]?.[0] ?? "").includes("\u001b[")).toBe(capabilities.color);
    expect(stderr).not.toHaveBeenCalled();
  });

  it.each(["ready", "review", "not-ready", "skip", "error"])("styles %s without changing semantics or global capabilities", async (kind): Promise<void> => {
    const originalLevel = chalk.level;
    const environment = { ...process.env };
    const plain = setup();
    const colored = setup({ stdoutIsTTY: true });
    await plain.reporter.report(reporterFixture(kind), { ci: false });
    await colored.reporter.report(reporterFixture(kind), { ci: false });
    const output = colored.stdout.mock.calls[0]?.[0] ?? "";
    expect(stripVTControlCharacters(output)).toBe(plain.stdout.mock.calls[0]?.[0]);
    expect(output).toContain("\u001b[36mShipcheck v0.1.0\u001b[39m");
    expect(output).toContain("\u001b[2m/workspace/example-service\u001b[22m");
    expect(output).toContain(kind === "not-ready" ? "\u001b[31mNOT READY" : kind === "review" || kind === "error" ? "\u001b[33mREVIEW" : "\u001b[32mREADY");
    expect(chalk.level).toBe(originalLevel);
    expect(process.env).toEqual(environment);
  });

  it("uses the four progress texts and stops before another start or final write", async (): Promise<void> => {
    const { reporter, stdout } = setup({ stdoutIsTTY: true, testMode: false });
    reporter.stopScanner();
    for (const id of ["git", "build", "test", "env"] as const) reporter.startScanner(id, { ci: false });
    expect(vi.mocked(ora).mock.calls.map(([options]): unknown => options)).toEqual([
      "Checking Git state…", "Running project build…", "Running project tests…", "Checking environment…",
    ].map((text): object => ({ text, stream: process.stdout, isEnabled: true, discardStdin: false })));
    expect(stop).toHaveBeenCalledTimes(3);
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[1] ?? 0);
    await reporter.report(reporterFixture(), { ci: false });
    expect(stop).toHaveBeenCalledTimes(4);
    expect(stop.mock.invocationCallOrder[3]).toBeLessThan(stdout.mock.invocationCallOrder[0] ?? 0);
    reporter.stopScanner();
    reporter.onModuleDestroy();
    expect(stop).toHaveBeenCalledTimes(4);
  });

  it("clears previous progress even when the next call disables animation", (): void => {
    const { reporter } = setup({ stdoutIsTTY: true, testMode: false });
    reporter.startScanner("git", { ci: false });
    reporter.startScanner("build", { ci: true });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(ora).toHaveBeenCalledTimes(1);
  });

  it("cleans up a partially failed start and propagates the failure", (): void => {
    const { reporter } = setup({ stdoutIsTTY: true, testMode: false });
    const error = new Error("test start failure");
    start.mockImplementationOnce((): never => { throw error; });
    expect((): void => reporter.startScanner("git", { ci: false })).toThrow(error);
    expect(stop).toHaveBeenCalledTimes(1);
    reporter.onModuleDestroy();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("does not print after failed progress cleanup and retries cleanup at shutdown", async (): Promise<void> => {
    const { reporter, stdout } = setup({ stdoutIsTTY: true, testMode: false });
    reporter.startScanner("git", { ci: false });
    stop.mockImplementationOnce((): never => { throw new Error("test stop failure"); });
    await expect(reporter.report(reporterFixture(), { ci: false })).rejects.toThrow("test stop failure");
    expect(stdout).not.toHaveBeenCalled();
    reporter.onModuleDestroy();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("waits for the writer to finish", async (): Promise<void> => {
    const { reporter, stdout } = setup();
    let release: (() => void) | undefined;
    stdout.mockReturnValueOnce(new Promise<void>((resolve): void => { release = resolve; }));
    let completed = false;
    const pending = reporter.report(reporterFixture(), { ci: false }).then((): void => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    if (!release) throw new Error("Deferred writer missing");
    release();
    await pending;
    expect(completed).toBe(true);
  });

  it.each([false, true])("propagates writer failure (synchronous=$0) with progress stopped", async (sync): Promise<void> => {
    const { reporter, stdout, stderr } = setup({ stdoutIsTTY: true, testMode: false });
    const error = new Error("test write failure");
    stdout.mockImplementationOnce((): Promise<void> => { if (sync) throw error; return Promise.reject(error); });
    reporter.startScanner("git", { ci: false });
    await expect(reporter.report(reporterFixture(), { ci: false })).rejects.toBe(error);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stderr).not.toHaveBeenCalled();
  });
});
