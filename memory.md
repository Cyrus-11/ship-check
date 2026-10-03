# Shipcheck project memory

Updated: 2026-10-03 12:51:49 WAT
Revision at save: main at 974fc86 (test: add full-pipeline integration fixtures), matching local origin/main. **Features 01–16 are committed.** The working tree was clean before this save; this memory refresh is the only new uncommitted change. Feature 15 is 08893c8; Feature 16 is 974fc86. No commit or push was performed by this save.

## Objective and current state

Build Shipcheck v0.1, a NestJS standalone release-readiness CLI for Node.js/TypeScript repositories using npm. Follow [AGENTS.md](AGENTS.md), including the ordered context reading on a new session.

**Features 01–16 are implemented and verified.** **Next: Feature 17 Executable and Package Smoke Test**, then 18 (documentation and release candidate). Feature 17 has its brief spec in [build-plan.md](context/build-plan.md); run `/architect` before implementation. No blocker or open product decision exists. v0.1 is not complete.

Scope remains help, version, scan and scan --ci; four sequential scanners (Git, Build, Tests, Environment). No HTTP server, database, frontend, configuration system, additional scanners/package managers/report formats, or public npm publication. Shipcheck-owned operations are read-only; repository-owned build/test scripts may have side effects. Never expose environment values, raw subprocess output, or error stacks in reports.

Plans and evidence: [build-plan.md](context/build-plan.md), [progress-tracker.md](context/progress-tracker.md), [scanner-registry.md](context/scanner-registry.md), [library-docs.md](context/library-docs.md), [architecture.md](context/architecture.md). Local setup: macOS / Node 24.21.0 / npm 11.19.0.

## Implemented boundaries

- **Fixtures (Feature 16, verification only):** [project-fixtures.integration.spec.ts](test/integration/project-fixtures.integration.spec.ts) runs the actual compiled CLI, without scanner probes, on seven fixture families in [test/fixtures/projects/](test/fixtures/projects/): ready, dirty Git, failing build, failing test, missing env, no example and invalid-project (missing/malformed manifest variants). Each runs in local/CI mode, totaling 16 cases.
  - Ready and skipped-env → 100 READY, exits 0/0; one failed scanner → 75 REVIEW, exits 0/1; invalid manifests → no report, safe stderr, exits 2/2.
  - Exact rows/counts/score/status/gate/streams/exits are asserted. Build/test markers prove order, child CI=true, and tests continuing after build failure. Only synthetic values are used; values and raw subprocess sentinels stay out of reports.
  - [project-fixture.ts](test/helpers/project-fixture.ts) copies fixtures to fresh temporary paths containing spaces, materializes `.env`/`.env.local` from ordinary seed filenames, initializes/commits local Git on main, isolates Git/npm/config/probe/environment settings, and cleans up only its owned temporary root.
  - File snapshots include ignored files and permit only exact `.generated` build/test artifacts; original bytes and Git HEAD/staged diff/porcelain status stay unchanged. Source fixtures are compared before/after the suite.
  - No fixture dependencies are installed or network commands executed. Existing `reject-network-listen.ts` rejects listeners only; it is not an outbound network guard or sandbox.

- **Exits (Feature 15, verification only — no production change):** `ScanCommand` awaits `ScanService.scan()` (which awaits `reporter.report()`), then assigns `process.exitCode = selectExitCode(Pick<ScanReport,"gatePassed">, ci)`. The results:
  - Local scans exit 0. CI scans exit 0 for READY and 1 for REVIEW/NOT READY, including a scanner error.
  - Usage, discovery, startup, service, render and cleanup failures exit 2.
  - Scanner-assigned `process.exitCode` values are overwritten by the command.
  - [exit-ownership.spec.ts](test/unit/common/exit-ownership.spec.ts) allows `process.exitCode` only in `bootstrap.ts` and `commands/scan.command.ts`, and forbids `process.exit(` in `src/`.
  - Ambient CI does not select command mode.
- **Pipeline (Feature 12):** `ScanService.scan()` reads the Clock, discovers the project once, then awaits each `SCANNERS` entry in order. Each scanner is wrapped in `reporter.startScanner`/`stopScanner` (in `finally`).
  - An unexpected scanner throw becomes a safe `error` result ("Scanner could not complete"); the thrown value is never retained.
  - The service scores once, copies score/status/gate explicitly, awaits `report()` once and returns the identical report.
  - Discovery/progress/scoring/report/Clock failures propagate to bootstrap, which prints a safe message and exits 2.
- **Bootstrap and discovery:** bootstrap runs once through CommandFactory. Help/version are independent of the target cwd, and the version comes from Shipcheck's package metadata. Discovery reads only `<cwd>/package.json` via FileSystem; a blank name falls back to the directory basename.
- **ProcessRunner:** separate file/args, `shell:false`, closed stdin, 1,000,000-byte capture per stream.
  - Timeout → `timedOut:true` / exit 1.
  - Start failures → ProcessStartError; other failures → ProcessExecutionError.
  - Git timeout is 10s; build/test 120s.
- **Scanners:**
  - Git: non-repo or dirty → failed. Later failures → error.
  - Build/Test: a missing script fails without spawning. Nonzero exit, timeout or overflow → failed. Adapter failures → error. Tests set `CI=true` in the child only.
  - Env: uses `dotenv.parse`. No example file → skipped. Missing names → failed, reporting sorted names only.
- **Scoring:** skipped weights are excluded; failed and error weights count as applicable with no points. The percentage is rounded once. Only READY (≥90) passes.
- **Reporter:** only TerminalReporter imports Chalk/Ora. It shows only failed Environment details (five names plus overflow; lines ≤160 code points) and omits durations. Color and animation are off under CI, non-TTY or NO_COLOR, and animation is also off in test mode.

## Durable decisions and lessons

- Fixture scripts use native ESM `.mjs` and Node built-ins. Environment seed filenames avoid root `.env.*` ignore rules; all 40 fixture input files are tracked in Git. Do not create source-fixture `.env` files or run their scripts in place.
- **npm requires distinct user/global config paths.** The first fixture run failed because npm rejected double-loading one empty file. A direct isolated npm reproduction identified the cause; separate empty files fixed it. Do not reuse one path for both config roles.
- **Vitest 5.0.1 has no `describe.sequential`.** Use `describe(name, { concurrent: false }, body)`, supported by installed SuiteOptions. The initial compiler failure was corrected using its exported types and official docs.

- **Never run an unprobed `shipcheck scan` from Shipcheck's own repository in tests.** It would run this test suite recursively. Use isolated temporary projects (`withMinimalProject` in [scan-command.integration.spec.ts](test/integration/scan-command.integration.spec.ts): `GIT_CEILING_DIRECTORIES` set to the parent of the realpath, `GIT_DIR`/`GIT_WORK_TREE` unset). Compare printed paths using `realpath` (macOS maps /var to /private/var).
- **Probe patterns:**
  - [scan-probe.ts](test/helpers/scan-probe.ts) replaces `ScanService.scan`.
  - [scanner-result-probe.ts](test/helpers/scanner-result-probe.ts) replaces only the four dist scanner `run` prototypes, keeping the real CLI, scoring and reporter. It is controlled by `SHIPCHECK_SCANNER_PROBE` (`ready`/`review`/`not-ready`/`throw`/`report-fails`) and `SHIPCHECK_SCANNER_EXIT`. Reuse it whenever a real-pipeline report is needed without running repository code.
  - [scan-orchestration-probe.ts](test/helpers/scan-orchestration-probe.ts) overrides `SCANNERS` in a Nest test module.
  - Probes must import runtime classes from `dist/` so module identities match.
- Compiled Nest test modules that include ReporterModule must `.overrideProvider(REPORTER_VERSION)`. The production loader can't resolve `package.json` from `.test-dist`; don't weaken that loader.
- Baseline: Node >=22.12, native ESM, strict TypeScript, NodeNext, runtime `.js` relative imports. Pinned versions: Nest 11.2.5, nest-commander 3.21.0, TypeScript 5.9.3, Vitest 5.0.1, Chalk 4.1.2, Ora 5.4.1, Execa 10.0.1, dotenv 18.0.4. Don't upgrade Nest blindly: the installed discovery dependency requires Nest 11. The ES2022 lib lacks Promise.withResolvers typings; use typed deferred Promises in tests.
- `npm test` builds `dist` and compiles the tests with tsc into `.test-dist` before Vitest runs. Vitest resets, clears and restores mocks automatically.
- nest-commander child commands need explicit strictness and throwing parser-exit overrides. A cleanup failure overrides success with exit 2.
- Under `exactOptionalPropertyTypes`, omit undefined fields. Under `noUncheckedIndexedAccess`, use optional chaining for mock tuples.
- Windows:
  - Execa's internal cmd.exe handling of npm.cmd is an approved exception.
  - Executable-lookup mocks use a fixed `C:\tools\node.exe`.
  - The suite runs as `NO_COLOR=1 npm test -- --maxWorkers=4`.
- Build/Test timeout and overflow count as failed; Git operational failures count as error. Don't add real 120-second tests.
- In zsh, a `$VAR` holding a multi-word command does not word-split, and `$?` after a pipe needs `${pipestatus[1]}`. Write JSON fixtures with a file tool.

## Verification and limits

Feature 16, 2026-10-03, macOS / Node 24.21.0 / npm 11.19.0:
- Production build and test compilation passed.
- `NO_COLOR=1 npx --no-install vitest run .test-dist/test/integration/project-fixtures.integration.spec.js --maxWorkers=1` passed all 16 cases twice after the harness corrections.
- `NO_COLOR=1 npm test -- --maxWorkers=4` passed **376 tests across 30 files** (360 existing + 16 fixture cases).
- Manual compiled CI runs on temporary ready/failing-build fixtures: 100 READY/exit 0 and 75 REVIEW/exit 1; Tests/Environment continued after build failure, stderr empty.
- Review covered plan alignment, runtime boundaries, setup/cleanup ownership, output safety, mutation accounting and platform limits; no actionable findings.
- `git diff --check` passed. Separate whitespace checks covered all 42 new files. Git visibility check found all 40 fixture inputs, none ignored. Trailing blank lines in fixture inputs were normalized after test verification; this whitespace-only cleanup was not followed by a test rerun.
- README, build plan, tracker, scanner registry and library notes now record completion and Feature 17 as next. No production code, dependencies or runtime baseline changed.

Feature 15 previously passed build/test compilation, 64 focused checks and 360 tests across 29 files, plus manual ready/dirty scan exits on macOS. Its exit cases remain passing within the current full gate.

Unverified:
- minimum Node 22.12
- Linux
- Windows for reporter, orchestration, exit propagation and Feature 16 fixtures
- installed packaging (Feature 17)

There is no global npm link. Public npm publication remains outside scope.

## Next steps

1. Run `/architect` for Feature 17, inspecting the current bin/files/private metadata, package-version loading, compiled layout and installed npm launcher behavior. Keep its plan in `context/build-plan.md`.
2. Feature 17 must build from source, run `npm pack --dry-run`, inspect package contents, install/link locally in an owned temporary directory, and invoke help/version/local scan/CI scan through the executable name from a target project's cwd. Reuse fixture setup without scanning Shipcheck's own repository. No public npm publication.
3. Then Feature 18: final README usage/output, context consistency review and complete release-candidate verification. Retain honest platform limits; do not mark v0.1 complete before required packaging checks pass.
