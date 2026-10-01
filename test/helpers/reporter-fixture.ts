import type { ScanReport } from "../../src/common/types/scan-report.type.js";

export function reporterFixture(kind: string = "ready"): ScanReport {
  const report: ScanReport = {
    projectName: "example-service", cwd: "/workspace/example-service",
    results: [
      { id: "git", name: "Git", status: "passed", summary: "Working tree is clean (main)", details: [], durationMs: 12, weight: 25 },
      { id: "build", name: "Build", status: "passed", summary: "npm run build passed", details: [], durationMs: 1400, weight: 25 },
      { id: "test", name: "Tests", status: "passed", summary: "npm test passed", details: [], durationMs: 342, weight: 25 },
      { id: "env", name: "Environment", status: "passed", summary: "2 required variables are present", details: [], durationMs: 1, weight: 25 },
    ], score: 100, status: "READY", gatePassed: true, durationMs: 2000,
  };
  const env = report.results.find((result): boolean => result.id === "env");
  const build = report.results.find((result): boolean => result.id === "build");
  const git = report.results.find((result): boolean => result.id === "git");
  if (!env || !build || !git) throw new Error("Invalid test fixture");
  if (kind === "skip") Object.assign(env, { status: "skipped", summary: "No .env.example found" });
  if (kind === "review" || kind === "not-ready") {
    Object.assign(env, { status: "failed", summary: "Missing 2 required variables", details: ["DATABASE_URL", "REDIS_URL"] });
    Object.assign(report, { score: 75, status: "REVIEW", gatePassed: false });
  }
  if (kind === "not-ready") {
    Object.assign(build, { status: "failed", summary: "npm run build failed" });
    Object.assign(report, { score: 50, status: "NOT_READY" });
  }
  if (kind === "error") {
    Object.assign(git, { status: "error", summary: "Scanner could not complete" });
    Object.assign(report, { score: 75, status: "REVIEW", gatePassed: false });
  }
  return report;
}
