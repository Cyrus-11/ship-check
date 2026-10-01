# Shipcheck project memory

Updated: 2026-10-01 22:21:55 WAT
Revision at save: main at a7ad918 (feat: add scan orchestration), pushed to origin/main. Working tree was clean before this save; this memory.md update is the only uncommitted change.

## Objective and current state

Build Shipcheck v0.1, a NestJS standalone release-readiness CLI for Node.js/TypeScript repositories using npm. Follow [AGENTS.md](AGENTS.md), including the ordered context reading on a new session.

**Features 01–14 are implemented, verified, committed and pushed. Next: Feature 15 CI Exit Enforcement**, then 16–18. Feature 15 has only the brief spec in [build-plan.md](context/build-plan.md). It has not been architected; run `/architect` before implementing it. No blocker or open product decision exists.

Scope remains help, version, scan and scan --ci; four sequential scanners (Git, Build, Tests, Environment). No HTTP server, database, frontend, configuration system, additional scanners/package managers/report formats, or public npm publication. Shipcheck-owned operations are read-only; repository-owned build/test scripts may have side effects. Never expose environment values, raw subprocess output, or error stacks in reports.

Plans and evidence: [build-plan.md](context/build-plan.md), [progress-tracker.md](context/progress-tracker.md), [scanner-registry.md](context/scanner-registry.md), [library-docs.md](context/library-docs.md), [architecture.md](context/architecture.md). Local setup: macOS / Node 24.21.0 / npm 11.19.0.

Recent commits: 598bf99 Feature 14 reporter; c55c741 stopped tracking `.claude/` and `.agents/` (skills reinstall from `skills-lock.json`; local skills architect/recover/remember/review remain installed); a7ad918 Feature 12.

## Implemented boundaries

- **Pipeline (Feature 12, live):** `ScanService.scan()` reads the Clock, then discovers the project once. It awaits each `SCANNERS` entry in `for…of` order with `reporter.startScanner`/`stopScanner` (in `finally`) around each one. An unexpected scanner throw becomes that scanner's own safe result: `error`, `Scanner could not complete`, empty details, measured duration. The thrown value is never retained. The service then scores once and copies score/status/gate explicitly (no spread). It measures duration (discovery+scan+scoring, excluding render), awaits `reporter.report()` once, and returns the identical report. Discovery/progress/scoring/report/Clock failures propagate to bootstrap → safe message, exit 2. `ScanModule` imports Infrastructure, Scanners, Scoring and Reporter modules.
- Command/bootstrap own exits: `ScanCommand` awaits the service, then `selectExitCode(Pick<ScanReport,"gatePassed">, ci)`; local 0, CI 0/1; usage/discovery/unexpected → 2. Ambient CI does not select command mode. Bootstrap runs once through CommandFactory; help/version are independent of the target cwd; the version comes from Shipcheck package metadata.
- Discovery resolves process.cwd() once and reads only `<cwd>/package.json` via FileSystem, keeping string name/build/test fields; a missing or blank name falls back to the basename. ProjectDiscoveryError carries safe text.
- ProcessRunner: separate file/args, shell:false, explicit cwd/timeouts, closed stdin, 1,000,000-byte capture per stream. Timeout → timedOut:true/exit 1. Start failures → ProcessStartError, others → ProcessExecutionError. Git timeout is 10s; build/test 120s; termination grace 5s.
- Git: non-repo/dirty → failed, clean → passed, later failures/timeouts → error; it reports only the branch and a changed-file count. Build/Test: missing/blank script → failed without spawning; nonzero/timeout/overflow → failed; adapter failures → error; tests set CI=true only in the child process. Env: dotenv.parse; missing example → skipped; missing names → failed with sorted names only; values never enter results or process.env.
- Scoring excludes skipped weights, counts failed/error weights as applicable without points, rounds once, and passes only READY (≥90). Empty or all-skipped results → 0/NOT_READY.
- Reporter (Feature 14): only TerminalReporter imports Chalk/Ora. It preserves registry order and canonical names/labels, displays NOT_READY as "NOT READY", shows only failed Environment details (five names plus overflow; lines ≤160 code points), strips control characters, and omits durations. Color requires a TTY, no NO_COLOR and ci=false; animation also requires that test mode is off (VITEST=true or NODE_ENV=test). writeOutput awaits the stream callback. See the output tokens/rules docs.

## Durable decisions and lessons

- **Never run an unprobed `shipcheck scan` from Shipcheck's own repository in tests.** It would run this test suite recursively. `test/helpers/scan-probe.ts` never delegates to the real `scan()`, and `scan-command.integration.spec.ts` uses `withMinimalProject` (temporary project, `GIT_CEILING_DIRECTORIES` = parent of realpath, GIT_DIR/GIT_WORK_TREE unset). Compare printed paths using `realpath` (macOS /var → /private/var).
- Compiled Nest test modules that include ReporterModule (ScanModule/CommandsModule/AppModule) must `.overrideProvider(REPORTER_VERSION)`. The package-relative version loader cannot resolve `package.json` from `.test-dist`. Do not weaken the production loader; native probes in `dist/` exercise it.
- Native probes must import runtime tokens/classes from one `dist/` tree; `test/helpers/scan-orchestration-probe.ts` is the pattern for production-DI checks with a controlled `SCANNERS` override.
- Baseline: Node >=22.12, native ESM, strict TypeScript NodeNext, runtime .js relative imports, MIT/private package. Nest 11.2.5, TypeScript 5.9.3, Vitest 5.0.1, Chalk 4.1.2, Ora 5.4.1 (exact direct deps). Do not blindly upgrade Nest: nest-commander requires Nest 11. The ES2022 lib lacks Promise.withResolvers typings; use typed deferred Promises in tests.
- npm test builds dist and compiles tests with tsc into .test-dist before Vitest, preserving constructor metadata. Vitest config has mockReset/clearMocks/restoreMocks on.
- nest-commander child commands need explicit strictness and throwing parser-exit overrides. Bootstrap applies parser exits after cleanup; a cleanup failure overrides success.
- Under exactOptionalPropertyTypes, omit undefined fields; use optional chaining for mock tuples under noUncheckedIndexedAccess.
- Windows: Execa's internal cmd.exe handling of resolved npm.cmd is an approved exception (shell:false is kept). Descendant cleanup is best effort; run the full suite with normal process permissions and `NO_COLOR=1 npm test -- --maxWorkers=4`. Windows executable-lookup mocks use a fixed `C:\tools\node.exe`.
- Build/Test timeout and overflow mean failed; Git operational failures mean error. Do not add real 120-second scanner tests.
- In zsh, a `$VAR` holding a multi-word command does not word-split. Use literal commands, and write JSON fixtures with a file tool rather than nested shell quoting.

## Verification and limits

Feature 12, 2026-10-01, macOS / Node 24.21.0:
- Build, test compilation, 77 focused checks and the full **336 tests across 28 files** passed. `git diff --check` passed. The production-DI probe verified sequential controlled execution, report identity and clean streams.
- Manual compiled-CLI runs on a scratch npm/Git project: dirty tree (local 0 / CI 1), clean READY (CI 0), missing env names (CI 1, names only, empty stderr, tree unchanged). A PTY run showed per-scanner spinners cleared before the colored report.
- Scoped review: one hardening item (explicit score/status/gate copy) was applied.

Unverified: minimum Node 22.12, Linux, the reporter/orchestration on Windows, the full exit matrix (15), representative fixtures (16) and installed packaging (17). No global npm link. v0.1 is not complete.

## Next steps

1. Run `/architect` for Feature 15. The pipeline already produces real local/CI exits, so Feature 15 is likely mostly verification: a command unit exit matrix; compiled CLI process tests for 0/1/2 using isolated temporary projects, never this repo; report present before exit; scanners cannot set exits.
2. Then Feature 16 (representative fixture suite), 17 (package/executable smoke test) and 18 (docs and release candidate). Commit/push only when requested.
