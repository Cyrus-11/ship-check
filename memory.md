# Shipcheck project memory

Updated: 2026-10-02 13:38:20 WAT
Revision at save: main at 35897b4 (docs: save Feature 12 handoff), in sync with origin/main. **Feature 15 is uncommitted.** Changed: `context/architecture.md`, `context/build-plan.md`, `context/progress-tracker.md`, `test/integration/scan-command.integration.spec.ts`, `test/unit/commands/scan.command.spec.ts`. New: `test/helpers/scanner-result-probe.ts`, `test/unit/common/exit-ownership.spec.ts`. Plus this memory.md. The user has not yet asked to commit or push.

## Objective and current state

Build Shipcheck v0.1, a NestJS standalone release-readiness CLI for Node.js/TypeScript repositories using npm. Follow [AGENTS.md](AGENTS.md), including the ordered context reading on a new session.

**Features 01–15 are implemented and verified.** 01–14 are committed and pushed; 15 is uncommitted (see above). **Next: Feature 16 Integration Fixture Suite**, then 17 (package/executable smoke test) and 18 (docs and release candidate). Feature 16 has only the brief spec in [build-plan.md](context/build-plan.md); run `/architect` before implementing it. No blocker or open product decision exists.

Scope remains help, version, scan and scan --ci; four sequential scanners (Git, Build, Tests, Environment). No HTTP server, database, frontend, configuration system, additional scanners/package managers/report formats, or public npm publication. Shipcheck-owned operations are read-only; repository-owned build/test scripts may have side effects. Never expose environment values, raw subprocess output, or error stacks in reports.

Plans and evidence: [build-plan.md](context/build-plan.md), [progress-tracker.md](context/progress-tracker.md), [scanner-registry.md](context/scanner-registry.md), [library-docs.md](context/library-docs.md), [architecture.md](context/architecture.md). Local setup: macOS / Node 24.21.0 / npm 11.19.0.

## Implemented boundaries

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

- **Never run an unprobed `shipcheck scan` from Shipcheck's own repository in tests.** It would run this test suite recursively. Use isolated temporary projects (`withMinimalProject` in [scan-command.integration.spec.ts](test/integration/scan-command.integration.spec.ts): `GIT_CEILING_DIRECTORIES` set to the parent of the realpath, `GIT_DIR`/`GIT_WORK_TREE` unset). Compare printed paths using `realpath` (macOS maps /var to /private/var).
- **Probe patterns:**
  - [scan-probe.ts](test/helpers/scan-probe.ts) replaces `ScanService.scan`.
  - [scanner-result-probe.ts](test/helpers/scanner-result-probe.ts) replaces only the four dist scanner `run` prototypes, keeping the real CLI, scoring and reporter. It is controlled by `SHIPCHECK_SCANNER_PROBE` (`ready`/`review`/`not-ready`/`throw`/`report-fails`) and `SHIPCHECK_SCANNER_EXIT`. Reuse it whenever a real-pipeline report is needed without running repository code.
  - [scan-orchestration-probe.ts](test/helpers/scan-orchestration-probe.ts) overrides `SCANNERS` in a Nest test module.
  - Probes must import runtime classes from `dist/` so module identities match.
- Compiled Nest test modules that include ReporterModule must `.overrideProvider(REPORTER_VERSION)`. The production loader can't resolve `package.json` from `.test-dist`; don't weaken that loader.
- Baseline: Node >=22.12, native ESM, strict TypeScript, NodeNext, runtime `.js` relative imports. Pinned versions: Nest 11.2.5, nest-commander 3.21.0, TypeScript 5.9.3, Vitest 5.0.1, Chalk 4.1.2, Ora 5.4.1, Execa 10.0.1, dotenv 18.0.4. Don't upgrade Nest blindly: nest-commander requires Nest 11. The ES2022 lib lacks Promise.withResolvers typings; use typed deferred Promises in tests.
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

Feature 15, 2026-10-02, macOS / Node 24.21.0:
- Build, test compilation, 64 focused checks, the full **360 tests across 29 files** and `git diff --check` all passed.
- Manual compiled-CLI runs on a scratch npm/Git project:
  - clean tree, `--ci` → READY, exit 0
  - dirty tree, local → exit 0
  - dirty tree, `--ci` → NOT READY (67), exit 1

Unverified:
- minimum Node 22.12
- Linux
- Windows for the reporter, orchestration and exit propagation
- representative fixtures (Feature 16)
- installed packaging (Feature 17)

There is no global npm link. v0.1 is not complete.

## Next steps

1. If the user asks, commit and push Feature 15. Suggested message: `test: verify CI exit enforcement`, ending with the required Co-Authored-By line.
2. Run `/architect` for Feature 16: seven fixtures (ready, dirty Git, failing build, failing test, missing env, no `.env.example`, invalid/non-Node directory).
   - Copy committed fixtures into temporary directories and initialize Git inside each copy.
   - Use no network.
   - Check for mutation while allowing for build/test script output.
   - Consider extracting `runCli`/`withMinimalProject` from the scan-command spec into a shared helper.
3. Then Features 17 and 18.
