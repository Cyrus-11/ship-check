# Progress Tracker

Update this file after every completed feature. Any engineer or AI agent reading it should immediately know what is complete, what is being worked on, and what comes next.

---

## Current Status

**Version:** v0.1.0

**Phase:** Phase 5 — Verification and Packaging

**In progress:** None

**Last completed:** 17 Executable and Package Smoke Test

**Next:** 18 Documentation and v0.1 Release Candidate

**Feature 17 — 2026-10-04:** Implemented `test/helpers/package-smoke.ts` and dedicated `test:package`. Fresh source build, dry-run/real pack, 51-file JS distribution plus metadata/README/LICENSE, temporary tarball installation, npm ls, offline clean reinstall and actual npm launcher assertions passed on macOS / Node 24.21.0 / npm 11.19.0. Help/version work outside the checkout and ignore target version; READY local/CI exits 0/0; failed-build REVIEW exits 0/1 with later scanners passing; usage/missing manifest exit 2. Exact safe streams and fixture/Git preservation passed. Incomplete offline cache returns 1/ENOTCACHED with no registry fallback. `--prepare` permits initial cache population; verified reinstall is offline. Initial sandbox ENOTFOUND was resolved with registry permission. npm supplies installed executable permissions. Production/test compilation and all 376 tests across 30 files passed. No dependency, lockfile, engine or scanner changes, global link or publication. Windows/Linux/minimum Node remain unverified. Feature 18 is next; uncommitted.

**Feature 17 planning — 2026-10-04:** Recorded an architecture plan in `build-plan.md` against clean `main` at `dc6fb7a`. Plan uses a real tarball, an isolated local consumer and npm-generated launchers; narrows distribution to production JS plus mandatory metadata/README/LICENSE; separates dependency-cache preparation from offline installed-package assertions. Covers help/version outside a project, READY and failing-build local/CI scans, fatal exits, target cwd, safe output and fixture mutation accounting. Scanner registry remains accurate; no scanner change is planned. No implementation, build, pack, installation or tests performed. Feature 17 remains unfinished; no blocking product decision. Feature 16 is committed at `974fc86`; its earlier uncommitted handoff notes are historical.

**Blockers:** None

**Feature 16 — 2026-10-03:** Implemented the planned full-pipeline fixture suite without production or dependency changes. Added seven fixture families in `test/fixtures/projects/`, isolated real Git/npm/compiled-CLI setup and snapshots in `test/helpers/project-fixture.ts`, and 16 local/CI cases in `test/integration/project-fixtures.integration.spec.ts` (invalid-project has missing/malformed variants). Exact rows, counts, scores, statuses, gates, stdout/stderr and exits are asserted. Synthetic environment values and subprocess sentinels never appear in reports. Build/test artifacts prove order, CI=true and continuation after build failure; complete file snapshots allow only those exact artifacts, compare Git HEAD/index/status and preserve source fixtures. Production/test compilation passed; the focused 16-case suite passed twice; `NO_COLOR=1 npm test -- --maxWorkers=4` passed all 376 tests across 30 files. Manual compiled CI runs confirmed READY/exit 0 and failed-build REVIEW/exit 1 with later scanners passing and empty stderr. Review found no actionable findings; scanner registry and README were updated. Verified on macOS / Node 24.21.0 / npm 11.19.0; Windows, Linux, minimum Node 22.12 and installed packaging remain unverified. Feature 17 is next. Changes are uncommitted.

**Feature 16 planning — 2026-10-03:** Recorded an architecture plan in `build-plan.md` against clean `main`/local `origin/main` at `5df2929`. It exercises the real compiled CLI using seven dependency-free fixture families (invalid-project has missing/malformed manifest variants), each in local/CI mode. Includes isolated Git/npm/environment settings, realpath handling, exact reports/exits, synthetic output leak checks, deterministic build/test markers, and filesystem snapshots with explicit generated-artifact allowances. Existing probe tests remain. Scanner registry was checked and remains accurate; no scanner behavior changes are planned. No implementation, dependency installation, build or tests performed. Feature 16 remains next; no blocking decision.

**Feature 15 — 2026-10-02:** Verified the public exit behavior end to end without changing production code, following the plan in `build-plan.md`. New `test/helpers/scanner-result-probe.ts` preload replaces only the four compiled scanners' `run` methods (and, in one mode, `TerminalReporter.report`), so real orchestration, scoring, rendering, command and bootstrap run without spawning Git or npm. `scan-command.integration.spec.ts` now asserts the full rendered report and exit for READY (0/0), REVIEW and NOT READY (0/1), a throwing scanner (0/1, never 2), scanners that assign `process.exitCode` 0/1/2 (command result wins), and a rendering failure (empty stdout, fixed fatal stderr, exit 2 in both modes). New `test/unit/common/exit-ownership.spec.ts` fails if `process.exit(` appears in `src/` or `process.exitCode` appears outside `bootstrap.ts` and `commands/scan.command.ts`. `scan.command.spec.ts` adds a status-named READY/REVIEW/NOT_READY × local/CI matrix and overwritten-exit cases. Production/test compilation, 64 focused checks and the full 360 tests across 29 files passed; `git diff --check` passed. Manual compiled-CLI runs on a scratch npm/Git project: clean READY `--ci` exit 0; dirty tree local exit 0 and `--ci` exit 1 (NOT READY 67). Scanner registry remains accurate. Verified on macOS / Node 24.21.0 only; Windows exit propagation and minimum Node 22.12 remain unverified.

**Feature 12 — 2026-10-01:** Activated the real scan pipeline. `ScanService` injects FileSystem, the `SCANNERS` registry, Clock, ScoringService and TerminalReporter, and `ScanModule` imports the scoring and reporter modules. The service:
- discovers the project once and awaits each scanner in registry order, wrapping each one in a balanced progress start/stop;
- turns an unexpected scanner throw into that scanner's own safe `error` result (`Scanner could not complete`, empty details, measured duration) and keeps going;
- scores once, awaits one rendered report, and returns that same `ScanReport`.

Discovery, progress, scoring, reporting and Clock failures remain fatal (exit `2`). Tests no longer scan Shipcheck's own repository: the command probe returns controlled reports, and unprobed scans use isolated temporary projects with Git ceiling isolation. Compiled Nest test modules override `REPORTER_VERSION`.

Verification:
- Production/test compilation, 77 focused checks and the full 336 tests across 28 files passed. `git diff --check` passed.
- A production-DI probe verified sequential controlled execution, report identity and clean streams.
- Manual compiled-CLI runs on a scratch project with real Git/npm verified dirty, READY and missing-environment reports with correct local/CI exits, no leaked values and an unchanged tree. A PTY run verified spinner cleanup.
- Scoped review found one hardening item: copy score/status/gate explicitly. It was applied. The scanner registry entry was updated.
- Verified on macOS / Node 24.21.0 only. Windows, minimum Node 22.12, representative fixtures (Feature 16) and installed packaging (Feature 17) remain pending.

**Feature 12 planning recheck — 2026-10-01:** Rechecked the 2026-09-28 plan against clean `main` at `c55c741`, after Feature 14 was committed (`598bf99`) and pushed. The implemented scoring and reporter contracts match the plan without change, and no decision or dependency is needed. Recorded in `build-plan.md` the concrete tests that would recursively scan Shipcheck's own repository once orchestration activates, and their replacements: controlled probe reports, isolated temporary projects and one Git-ceiling-isolated minimal-project smoke run. Also recorded the stale temporary-shell documentation to correct. Scanner registry remains accurate. No implementation, build or tests were run.

**Feature 14 — 2026-10-01:** Implemented `TerminalReporter` and exported it through `ReporterModule`, with injected output/capability/version tokens, reporter-owned constants, awaited stream writes, semantic Chalk styling and local Ora progress. Reports preserve registry order, use canonical names/labels, count errors with failures, and render only failed Environment details (five names plus overflow; 160-code-point lines). Display controls are sanitized; scanner data is not mutated. Progress is cleared before reporting, between scanners and at Nest module destruction; CI/non-TTY/NO_COLOR/test mode suppress animation. Chalk 4.1.2 and Ora 5.4.1 were promoted from locked transitive dependencies to exact direct dependencies without package version or engine changes. All 47 focused reporter checks and the complete 322 tests across 27 files passed, including production/test compilation and native production-module probes. Manual PTY checks passed for local animation/style, final-report and shutdown cleanup, plain CI, empty NO_COLOR and 80-column output. Scoped review found no actionable findings; scanner registry remains accurate. Verified on macOS / Node 24.21.0; reporter behavior on Windows and minimum Node 22.12 remains unverified. ReporterModule is intentionally not imported into ScanModule until Feature 12. This record precedes the user-requested Feature 14 commit/push; check Git history/status for the resulting revision.

**Feature 14 planning — 2026-10-01:** Architecture plan recorded in `build-plan.md` against clean `main` at `4d92209`. Covers reporter DI/writers/capabilities, canonical output and safe detail limits, isolated Chalk styling, Ora cleanup, native production verification and failure cases. Chalk 4.1.2 and Ora 5.4.1 already exist transitively; the plan proposes declaring those exact versions directly, with no engine change. `report()` will return `Promise<void>` and Feature 12's plan now explicitly awaits it before returning to the command. Documented formatting interpretations for spacing, canonical casing, five names plus overflow, and optional duration omission. Scanner registry remains accurate; no scanner changes. No implementation, dependency installation, build or tests performed. Feature 14 remains next; no blocking decision.

**Local macOS setup — 2026-09-30:** Installed the existing lockfile with `npm ci` on Node 24.21.0 / npm 11.19.0 after granting registry network access. No dependency versions changed. Initial verification passed 274/275 tests; the Windows environment-merge unit test incorrectly mocked executable lookup with the host's `process.execPath`, which lacks `.exe` on macOS. Changed only the lookup mock to a fixed Windows `node.exe` path. `NO_COLOR=1 npm test -- --maxWorkers=4` then passed production/test compilation and all 275 tests across 23 files. Compiled CLI `--help` and `--version` passed (0.1.0). Scanner behavior and registry status remain unchanged. Feature 14 remains next; full pipeline and installed-package verification remain pending. npm reported an unapproved optional fsevents install script; the current build/test workflow passed without approving it.

**Feature 13 — 2026-09-28:** Implemented `ScoringService.calculate(readonly ScanResult[])` and exported it through `ScoringModule` according to `build-plan.md`. The pure calculation excludes skipped weights, counts failures/errors as applicable without points, rounds the final percentage once, uses shared readiness thresholds, and passes the gate only for READY. Empty/all-skipped input returns zero/NOT_READY/false. Production/test builds, all 23 focused scoring checks, and the full 275-test suite across 23 files passed on Windows / Node 24.16.0. Tests include rounding boundaries, supplied weights, input immutability, independent calls, and injection into an importing module's consumer. Scoped review found no actionable findings; scanner registry verified accurate. No new dependencies or architecture deviations. Pipeline wiring remains Feature 12; Feature 14 is next. The user requested saving, committing, and pushing on 2026-09-28; this handoff precedes those Git operations. Check history/status for their final revision.

**Feature 12 planning — 2026-09-28:** Architecture plan recorded in `build-plan.md` for sequential registry execution, per-scanner throw isolation, scoring, complete report assembly, reporter progress/final output, and production-DI verification. Planning found that Feature 12's required final report and reporter call depend on Features 13 and 14. The user approved the recommended Phase 4 order **13 → 14 → 12 → 15** on 2026-09-28. Feature 12 now waits for those two prerequisite providers; it is not blocked by an unresolved decision. No implementation or tests were run.

**Feature 11 — 2026-09-27:** Implemented the shared `SCANNERS` symbol, explicit ordered singleton factory, export from `ScannersModule`, and import into `ScanModule` according to `build-plan.md`. Production/test builds, seven focused registry checks, and all 252 tests across 22 files passed on Windows / Node 24.16.0. Registry composition is complete; scanner execution remains Feature 12.

**Feature 03:** Implemented and verified on 2026-09-21 against the architecture plan in `build-plan.md`. The shell performs no real checks or reporting yet; local/CI exits are `0`/`1` with the temporary failed-gate result.

**Feature 04:** Implemented and verified on 2026-09-21 against the plan in `build-plan.md`: complete domain contracts, canonical IDs/order/weights/thresholds, and migration from the temporary shell type to a gate projection of `ScanReport`. Real report assembly and scanner execution remain later features.

**Feature 05:** Implemented and verified on 2026-09-21 against the approved plan. Production/test compilation and all 139 tests across 11 files passed on Windows / Node 24.16.0. The user approved Execa's internal Windows npm.cmd launcher while retaining shell:false and separate executable/argument values. No scanner or scan-shell integration was added.

**Feature 06:** Implemented and verified on 2026-09-22 against the approved plan. `ScanService` now injects `FileSystem`, resolves `process.cwd()` once, reads and validates `<cwd>/package.json` (no parent traversal), narrows the untrusted JSON into the `PackageJson` projection, applies directory-basename fallback for a missing/blank name, and builds an immutable `ScanContext`. Fatal discovery errors (missing/invalid/unreadable `package.json`) surface a safe concise stderr message and exit `2` via `ProjectDiscoveryError` in `bootstrap`. Production build and all 158 tests across 12 files passed on Windows / Node 24.16.0. No scanners, scoring, or reporting were added; valid targets still return the temporary failed-gate shell result.

**Feature 07:** Implemented and verified on 2026-09-23 against the approved plan. `GitScanner` (`src/scanners/git/git.scanner.ts`) implements the `Scanner` contract (`id: "git"`, `name: "Git"`, weight from `SCANNER_WEIGHTS.git`) and runs read-only `git rev-parse --is-inside-work-tree`, `git branch --show-current`, and `git status --porcelain` via `ProcessRunner` under the 10s git timeout. Work-tree check failure maps to `failed` ("Not a Git repository"); post-work-tree execution failures and timeouts map to `error`; canonical clean/dirty summaries report the branch name (or `detached HEAD`) and dirty-file count only, with `details: []` (no changed paths leaked). New `ScannersModule` provides/exports `GitScanner`. Production build and all 175 tests across 14 files passed on Windows / Node 24.16.0 (17 new Git cases). The `SCANNERS` registry token is deferred to Feature 11; no scoring or reporting was added.

**Feature 08:** Implemented and verified on 2026-09-24 against the approved plan. `BuildScanner` (`src/scanners/build/build.scanner.ts`) implements the `Scanner` contract (`id: "build"`, `name: "Build"`, weight from `SCANNER_WEIGHTS.build`). It reads `packageJson.scripts.build`; a missing or blank script maps to `failed` ("package.json has no build script") without spawning npm. Otherwise it runs read-only `npm run build` via `ProcessRunner` under the 120s build timeout: a timeout maps to `failed` ("npm run build timed out after 120s"), a non-zero exit to `failed` ("npm run build failed"), and a zero exit to `passed` ("npm run build passed"). An output-capture overflow maps to `failed` ("npm run build failed"), while spawn and other adapter failures map to `error` ("Scanner could not complete"). `details` is always `[]` and no build output is rendered. Unlike the Git scanner, a build timeout is `failed`, not `error` (per the registry and cli-output-rules). `ScannersModule` now provides/exports `BuildScanner`. Production build and all 189 tests across 16 files passed on Windows / Node 24.16.0 (14 new Build cases). The `SCANNERS` registry token remains deferred to Feature 11; no scoring or reporting was added.

**Feature 09:** Implemented and verified on 2026-09-25 against the approved plan. `TestScanner` (`src/scanners/test/test.scanner.ts`) implements the `Scanner` contract (`id: "test"`, `name: "Tests"`, weight from `SCANNER_WEIGHTS.test`), mirroring `BuildScanner`. It reads `packageJson.scripts.test`; a missing or blank script maps to `failed` ("package.json has no test script") without spawning npm. Otherwise it runs read-only `npm test` via `ProcessRunner` under the 120s test timeout with a `CI=true` environment override (the parent `process.env` is never mutated): a timeout maps to `failed` ("npm test timed out after 120s"), a non-zero exit to `failed` ("npm test failed"), and a zero exit to `passed` ("npm test passed"). An output-capture overflow maps to `failed` ("npm test failed"), while spawn and other adapter failures map to `error` ("Scanner could not complete"). `details` is always `[]` and no test output is rendered. `ScannersModule` now provides/exports `TestScanner`. Production build and all 204 tests across 18 files passed on Windows / Node 24.16.0 (15 new Test cases). The `SCANNERS` registry token remains deferred to Feature 11; no scoring or reporting was added.

**Feature 10:** Implemented and verified on 2026-09-26 against the Feature 10 plan. `EnvScanner` uses `FileSystem`, `Clock`, and pinned `dotenv` 18.0.4 to parse required names from `.env.example` and evaluate non-whitespace presence across `.env`, `.env.local`, and `process.env`. Missing example skips; an empty contract passes; missing names fail with sorted name-only details; file/parser failures return a safe error. No environment values enter results or mutate `process.env`. `ScannersModule` provides/exports the concrete scanner; the ordered registry remains Feature 11. Production/test compilation and all 245 tests across 20 files passed on Windows / Node 24.16.0 (41 new Environment cases).

---

## Progress

### Phase 1 — Foundation

- [x] 01 Project Scaffold
- [x] 02 Nest Standalone CLI Bootstrap
- [x] 03 Scan Command Shell

### Phase 2 — Core Contracts and Infrastructure

- [x] 04 Domain Contracts and Constants
- [x] 05 Infrastructure Adapters
- [x] 06 Project Discovery and Scan Context

### Phase 3 — Scanners

- [x] 07 Git Scanner
- [x] 08 Build Scanner
- [x] 09 Test Scanner
- [x] 10 Environment Scanner
- [x] 11 Scanner Registry

### Phase 4 — Orchestration and Reporting

- [x] 12 Scan Orchestration
- [x] 13 Scoring Service
- [x] 14 Terminal Reporter
- [x] 15 CI Exit Enforcement

### Phase 5 — Verification and Packaging

- [x] 16 Integration Fixture Suite
- [x] 17 Executable and Package Smoke Test
- [ ] 18 Documentation and v0.1 Release Candidate

---

## Scanner Status

| Scanner     | Implementation | Unit tests | Integration coverage | Registry updated |
| ----------- | -------------- | ---------- | -------------------- | ---------------- |
| Git         | Complete       | Complete   | Complete             | Complete         |
| Build       | Complete       | Complete   | Complete             | Complete         |
| Tests       | Complete       | Complete   | Complete             | Complete         |
| Environment | Complete       | Complete   | Complete             | Complete         |

---

## Quality Gate Status

| Gate                       | Status      | Last verified |
| -------------------------- | ----------- | ------------- |
| TypeScript build           | Passed fresh production build and test compilation including package runner | 2026-10-04 |
| Unit tests                 | Passed in full 376-test suite; existing exit/adapter/scanner checks retained | 2026-10-04 |
| Integration tests          | Passed including 16 real compiled-CLI fixture cases across seven families, local/CI modes and both invalid-manifest variants | 2026-10-04 |
| Help/version smoke test    | Installed help/version passed outside checkout; target manifest version ignored; invalid usage returns 2 | 2026-10-04 |
| Local scan smoke test      | Installed READY/failed-build exact reports exit 0; missing manifest exits 2; existing fixture suite passed | 2026-10-04 |
| CI exit-code smoke test    | Full matrix passed through the real reporter: READY 0, REVIEW/NOT READY/scanner error 1 in CI, local 0; scanner-assigned exits overwritten; render/usage/discovery/bootstrap/cleanup failures 2 | 2026-10-02 |
| Package dry run            | Passed dry-run/real pack 51-file lists and installed bytes, dependency checks, offline reinstall and POSIX launcher | 2026-10-04 |
| Secret-leak negative check | Passed prior checks plus exact fixture reports, name-only missing details and absence of synthetic environment/subprocess sentinels | 2026-10-03 |
| Shipcheck-owned mutation check | Fixture source trees unchanged; temporary copies permit only exact build/test artifacts, with original bytes and Git HEAD/index/status unchanged; invalid copies unchanged | 2026-10-03 |

---

## Decisions Made During Build

### Context Decisions

- Shipcheck v0.1 supports Node.js and TypeScript repositories using npm only
- NestJS is used as a standalone application context, never as an HTTP server
- `nest-commander` owns the command layer
- Node.js 22.12+ is required to align with the current Vitest engine requirement
- Native ESM and TypeScript NodeNext modules are used
- The public command surface is limited to help, version, `scan`, and `scan --ci`
- The scanner order is Git, Build, Tests, Environment
- Scanners run sequentially
- Each scanner has weight 25
- Skipped checks are excluded from the score denominator
- `READY` begins at 90; `REVIEW` begins at 70
- Only `READY` passes the release gate
- Local completed scans return exit code 0; CI enforces the gate
- Environment values and Git file paths are never printed
- Shipcheck-owned operations never modify the scanned repository; repository-owned build/test scripts may generate files or perform other side effects

Add implementation-time decisions below this line with date, reason, and affected files.

### Feature 17 implementation and verification — 2026-10-04

- Narrowed package files to production JS, README and LICENSE; npm includes package.json. Compiler settings remain unchanged; updated the scaffold metadata assertion. Files/scripts are not recorded in lockfile root metadata, so no lockfile edit was required.
- A standalone compiled runner keeps registry preparation out of normal Vitest tests. Explicit `--prepare` populates an owned cache; `--cache` copies an existing cache and stays offline. Both modes perform clean offline npm ci with dependency scripts disabled. Empty-cache negative check passed without network fallback. Consumer lock stays unchanged through npm ci.
- Exported the existing fixture environment helper; no scanner behavior changed. POSIX launcher target/executable access, safe exact reports/exits, source fixture and Git preservation passed. Windows branch checks shipcheck.cmd with Execa's documented batch handling but was not run. Fixed checkout-derived dist cleanup and temporary-root finally cleanup preserve ownership.
- Local packaging acceptance is complete; Windows/Linux/Node 22.12 remain explicit gaps. Feature 18 owns final documentation/release-candidate review. No commit or push performed.
- Scoped review covered plan alignment, distribution metadata, real installation/launcher selection, dependency and fixture isolation, cleanup ownership, safe failures and documented platform limits; no actionable findings. Final package rerun passed after the installed-file symlink check and README changes. `git diff --check` passed.

### Feature 16 implementation and verification — 2026-10-03

- Followed the architecture plan without changing production code, dependencies or the engine baseline. `.mjs` replaces the proposed `.cjs` fixture extension to honor native ESM conventions. Each scan uses its own copy with a path containing spaces; no fixture dependencies are installed or network commands executed.
- Inspected installed Execa 10.0.1/Vitest 5.0.1 versions and exported option/suite types, plus official versioned documentation. No library-specific skill or documentation MCP was advertised. Test harnesses continue using Execa/Node filesystem APIs directly under the existing library-docs exception.
- Initial compilation exposed the removed `describe.sequential` API; the installed SuiteOptions contract supports `{ concurrent: false }`. Initial real fixture runs exposed npm's rejection of one config file loaded as both user and global. Reduced it to a direct npm invocation, then used separate empty config paths. No production defect or recurring failure remained after these focused corrections.
- Production/test compilation, both 16-case focused reruns and the full 376 tests across 30 files passed. Manual ready/failing-build CI scans produced 100 READY/exit 0 and 75 REVIEW/exit 1 respectively; both had empty stderr. Review covered plan alignment, setup/cleanup ownership, safe output, mutation accounting and verification limits; no actionable findings. README and scanner registry now include fixture coverage.
- Limits: macOS / Node 24.21.0 / npm 11.19.0 only. Windows, Linux, minimum Node 22.12 and installed executable packaging remain unverified. Feature 17 is next; no commit or push performed.

### Feature 15 implementation and verification — 2026-10-02

- No production change was needed: `ScanCommand` already assigned the exit after the awaited scan and report, and bootstrap already owned exit `2`. The feature added verification only.
- Controlled compiled scans patch scanner `run` prototypes from `dist` in a preload, rather than overriding `SCANNERS` in a test module, so the real CLI bootstrap and command path is exercised. Reuse `scanner-result-probe.ts` when a real-pipeline report is needed without executing repository code.
- Limits: macOS / Node 24.21.0 only. Representative fixtures (16) and installed packaging (17) remain.

### Feature 12 implementation and verification — 2026-10-01

- Followed the recorded plan and its 2026-10-01 recheck. The deviation is small hardening: score/status/gate are copied explicitly instead of spreading the scoring projection.
- Adding `ReporterModule` to `ScanModule` caused compiled Nest test modules (`scanners.module`, `scan.command`, `scaffold` specs) to fail. The package-relative version loader cannot resolve `package.json` from `.test-dist`. Those tests now override `REPORTER_VERSION`, matching the reporter's own tests. The production loader is unchanged and native probes still exercise it.
- Never run an unprobed `shipcheck scan` from Shipcheck's own repository in tests: it would execute this suite recursively. `scan-command.integration.spec.ts` enforces this with `withMinimalProject`, and `scan-probe.ts` never delegates to the real `scan()`.
- Limits: macOS / Node 24.21.0 only. The full exit matrix (15), representative fixtures (16) and installed packaging (17) remain.

### Feature 14 implementation and verification — 2026-10-01

- Followed the recorded plan; the extra `write-output.ts` helper isolates stream callback/error-event ordering for focused tests. It waits through backpressure, keeps an error listener through a failed write's event turn, removes its listener and never closes process streams. Writer failure rejects reporting, leaving the future command boundary responsible for safe fatal output.
- Output tokens/rules now resolve the documented ambiguities: literal 12-character name column plus one separator, canonical lowercase command summaries, five missing names plus overflow, 160 Unicode code points including detail prefix/ellipsis, and no optional duration suffix. Reporters trust safe scanner summaries; control stripping is not arbitrary-secret redaction. No scanner or scoring behavior changed.
- Dependency installation initially could not use offline registry metadata (`ENOTCACHED` for Ora); an approved network/cache-enabled npm install succeeded. Only root direct dependency declarations changed in the lockfile; installed package versions stayed unchanged. Install scripts were disabled.
- Initial test compilation rejected the test-only `Promise.withResolvers` call under the existing ES2022 library target. Replaced it with a typed deferred Promise; no compiler/runtime baseline change. The subsequent targeted run passed all 47 checks. `NO_COLOR=1 npm test -- --maxWorkers=4` passed compilation and 322 tests in 27 files (11.19s test execution). `git diff --check` passed.
- Scoped review covered plan alignment, Nest export visibility, ESM imports, state/cleanup, formatting, trust boundaries, callback/error ordering, snapshots, dependency diff and unchanged CLI/scanner behavior. No actionable findings within scope. Manual native PTY probes exercised real Ora; automated tests use fakes for animation and real streams for writer failures.
- Limits: macOS / Node 24.21.0 only for this feature; minimum Node, Windows, full pipeline, command report-before-exit integration and installed packaging remain pending. Next is Feature 12, which must await `report()` before returning to ScanCommand.

### Documentation Cleanup — 2026-09-20

- Renamed eight context files to remove the ` (1)` suffix and match the paths in `AGENTS.md` and internal references
- Clarified the side-effect boundary in the overview, architecture, code standards, scanner registry, build plan, and tracker to match `AGENTS.md`
- Updated mutation-check criteria to account for repository-owned build/test script side effects while keeping Shipcheck-owned operations read-only and committed fixture sources unchanged
- Documentation only; all 18 implementation features remain not started, with `01 Project Scaffold` next

### Scaffold Decisions — 2026-09-20

- Scope is feature 01 only; feature 02 CLI lifecycle/version integration and feature 03 scan command remain separate
- Selected Nest 11.2.5, nest-commander 3.21.0, TypeScript 5.9.3, Vitest 5.0.1, Execa 10.0.1, and Node 22 type definitions from npm metadata
- Initial installation with Nest 12 reported peer conflicts because nest-commander's discovery dependency requires Nest 11; corrected the manifest to Nest 11.2.5 before writing integration code. The final strict-peer install passed without warnings, the dependency tree resolves to one Nest version, and build/tests passed
- Keep the Node 22.12+ runtime baseline; development is currently on Node 24.16.0 with npm 11.13.0
- Compile tests with tsc before Vitest so constructor metadata is tested with the same decorator compiler settings as production
- User confirmed MIT licensing; package remains private because public npm publication is outside v0.1 scope
- Added strict NodeNext compiler configuration, shebang entry point, empty AppModule, compiled-test configuration, six scaffold checks, README, MIT license, and generated-artifact/environment-file ignores
- Verified scanner-registry.md still accurately lists all four scanners and their registry as not started; no scanner behavior changed
- Scoped review found no actionable issues in feature 01. Help currently renders the framework's basic `Usage: main [options]`; product naming, version handling, command registration, and complete exit/lifecycle behavior remain feature 02/03 work

---

## Bootstrap Decisions and Verification — 2026-09-20

- Added `CommandsModule` and a root provider for product help/name/description; bare invocation prints help, excess arguments are rejected, and the implicit help subcommand is disabled
- Added package-relative native JSON loading with version validation; help/version work outside the repository and ignore target-project/plugin metadata
- Kept one `CommandFactory.run()` invocation. Its parser override throws so Nest can finish asynchronous shutdown; the service handler recognizes captured parser signals by identity and rethrows unexpected failures. Parser exit codes are applied after cleanup; cleanup failure selects 2
- Added shared `EXIT_CODE` constants at the first bootstrap use rather than duplicating values until feature 04; that feature will reuse this file and remains incomplete
- Usage and fatal diagnostics are fixed safe text. No dependencies, scanner behavior, HTTP components, production test switches, or scan command were added
- Corrected the test helper's mapping of Execa's optional exitCode into the required test result field after the initial test compilation failure
- Initial in-process metadata tests failed with `ERR_IMPORT_ATTRIBUTE_MISSING` because Vitest's data-URL import path dropped JSON attributes. Moved these cases to native Node subprocesses loading the production module; preserved the validation cases and runtime implementation
- Final `npm test` with `NO_COLOR=1` passed production build, test compilation, and all 38 tests across 4 files
- Compiled CLI tests verify exact help/version, aliases, bare invocation, invalid options/commands/paths, package-relative version, disabled plugins, no target mutation, no listener, asynchronous shutdown, and safe startup/execution/cleanup failures. A command error resembling a successful parser signal still fails
- Manual `node dist/main.js --help` and `--version` returned 0; `--unknown` returned 2 with the usage hint
- Scoped review covered plan alignment, module/error boundaries, lifecycle, output safety, and coverage; no actionable findings remained. All four scanners and the registry remain accurately marked not started
- Documentation tooling recovery: the patch helper reported a Windows sandbox setup access error, and longer fallback shell edits stalled without changing the target documents. Stopped those processes, verified a minimal workspace write, and completed updates after the patch helper became available again. No application repair was needed
- Limits: Windows / Node 24.16.0 only. Node 22.12, other operating systems, installed npm launchers, and packaging remain unverified. Startup rejection is handled safely; factory cleanup is available only after application creation succeeds

---

## Deviations From Context

### Feature 10 implementation and verification — 2026-09-26

- Added `src/scanners/env/env.scanner.ts` and provided/exported `EnvScanner` from `ScannersModule`. The scanner uses the existing identity, weight, result contract, clock, and filesystem adapter; no process runner or command-layer change is needed. The ordered `SCANNERS` token remains Feature 11.
- Required keys come only from `dotenv.parse(.env.example)`. Example values do not satisfy presence; duplicates count once. Available sources are evaluated independently using trimmed non-empty values, so an empty source never masks a present value elsewhere. Only missing names are returned, alphabetically sorted and untruncated; the reporter owns the display limit.
- Missing/disappearing example maps to skipped; empty/comment-only example passes with zero required variables without reading optional sources. Optional `ENOENT` is ignored, including read races; other filesystem/parser failures map to `error` with `Scanner could not complete`. Error contents and environment values never enter results. File reads use absolute paths from the shared context.
- Added exact runtime dependency `dotenv` 18.0.4 after npm metadata and installed manifest/types/README inspection; Node >=12 satisfies the existing baseline. The initial sandbox npm lookup failed with EACCES; network-enabled lookup/install succeeded without peer warnings. A PowerShell inline-code quoting failure was corrected by piping a literal script to Node; the native named ESM import then passed. No dependency or runtime-scope deviation was needed.
- Added 33 unit cases and 8 integration cases covering approved sources, absent/empty/whitespace values, comments/quotes/duplicates, union presence, sorted complete missing-name lists, absence/read races/errors, duration, environment preservation, secret sentinel exclusion, and Nest injection. Real fixtures use temporary directories (including spaces), confirm byte-identical input files, and use directories in place of files for actual read errors. Permission-denied paths are mocked; no OS permission changes are required.
- A native helper (`test/helpers/env-scanner-probe.ts`) loads the production `dist` scanner/module through Nest, checks environment preservation, and lets the integration test independently assert exit code, stdout, stderr, and result shape. The helper remains outside production output.
- Review identified inherited environment properties as an edge case: a declared name such as `toString` must not be mistaken for a real environment value. Added `Object.hasOwn` and two regression cases. Empty-contract short-circuiting and local handling of raw filesystem/parser failures are recorded in the plan and registry.
- `npm run build`, `npm run test:compile`, and an initial 39-case focused run passed. The first full run passed 243 tests; after the inherited-property fix, `NO_COLOR=1 npm test -- --maxWorkers=4` passed production/test compilation and all 245 tests across 20 files. Four workers reduce the previously documented npm-subprocess timing susceptibility without changing test behavior. Full tests used normal Windows process permissions for fixture-tree cleanup. `git diff --check` passed.
- Review covered plan alignment, provider/adapter boundaries, names-only results, absence/error handling, dependency compatibility, and tests. No actionable findings remain within Feature 10 scope. Verified on Windows / Node 24.16.0 only; minimum Node, other OSes, full scanner orchestration/reporting, and installed-package smoke tests remain unverified.
- Next feature: 11 Scanner Registry. Implementation verification was recorded before the Feature 10 commit; the user requested saving the handoff, committing, and pushing on 2026-09-26. Check Git history for the final revision.

### Feature 09 implementation and verification — 2026-09-25

- Added `TestScanner` (`src/scanners/test/test.scanner.ts`) implementing the `Scanner` contract (`id: "test"`, `name: "Tests"`, weight from `SCANNER_WEIGHTS.test`), mirroring the `BuildScanner` pattern. It receives `ScanContext`, never reads `process.cwd()`, and returns exactly one fully populated `ScanResult`
- Reads `context.packageJson.scripts?.test`; a missing or blank (whitespace-only) script maps to `failed` ("package.json has no test script") without spawning npm (asserted by a never-called `ProcessRunner`). Otherwise runs read-only `npm test` (file `npm`, args `["test"]`, scan `cwd`, env override `{ CI: "true" }`) through `ProcessRunner` with the shared 120s test timeout
- Outcome mapping: timeout → `failed` ("npm test timed out after 120s"); non-zero exit → `failed` ("npm test failed"); output-capture overflow (`ProcessExecutionError` reason `output_limit`) → `failed` ("npm test failed"); zero exit → `passed` ("npm test passed"); `ProcessStartError` and other `ProcessExecutionError` reasons → `error` ("Scanner could not complete"). `details` is always `[]` and no test stdout/stderr is rendered
- Confirmed decision D5 (Build/Test symmetry): an output-capture overflow is a repo-owned `failed` check, not a Shipcheck `error`, per `cli-output-rules.md` §171; gate impact is unchanged since both are 0/25 applicable points. As with `BuildScanner`, a test timeout is a `failed` check, not `error`, and the `120s` in the message is derived as `PROCESS_LIMITS.TEST_TIMEOUT_MS / 1000` rather than hardcoded
- `CI=true` is injected only for the test subprocess via the `ProcessRunner` env override; the parent `process.env.CI` is asserted unchanged in both unit and integration tests
- `ScannersModule` now provides/exports `TestScanner` alongside `GitScanner` and `BuildScanner`; the `SCANNERS` injection token/wiring remains deferred to Feature 11. No scoring or reporting was added
- Added unit tests (`test/unit/scanners/test/test.scanner.spec.ts`) covering all registry cases (pass, missing/blank script without spawn, non-zero, timeout→failed, output-limit→failed, npm-unavailable and adapter→error, cwd/command/args/timeout/`CI=true` shape with parent env preserved, duration) plus a wiring test asserting `design:paramtypes` `[ProcessRunner, Clock]`; and integration tests (`test/integration/test-scanner.integration.spec.ts`) exercising a real temp project for passing, failing, missing-script, and a `CI=true`-dependent script with the parent environment left unchanged
- Refined the scaffold guard in `test/unit/scaffold.spec.ts`: the "keeps tests out of production output" assertion previously flagged any `test` path segment in `dist/`, which now falsely matched the legitimate production directory `dist/scanners/test/` (the Test scanner follows the mandated `scanners/<id>/<id>.scanner.ts` convention). Anchored the directory match to the dist root (`^test[\\/]`) so a leaked `test/` source tree is still caught while nested production `test` directories are not; the `.spec.` guard is unchanged
- `npm run build` and `npm test` passed all 204 tests across 18 files (189 prior + 15 new). No new dependencies. Verified on Windows / Node 24.16.0 only; Node 22.12, other OSes, installed npm launchers, and packaging remain unverified. `scanner-registry.md` updated: Test scanner marked complete with the output-limit fail condition and unit case
- Next feature: 10 Environment Scanner. Feature 09 is not committed or pushed

### Feature 08 implementation and verification — 2026-09-24

- Added `BuildScanner` (`src/scanners/build/build.scanner.ts`) implementing the `Scanner` contract (`id: "build"`, `name: "Build"`, weight from `SCANNER_WEIGHTS.build`), following the `GitScanner` pattern. It receives `ScanContext`, never reads `process.cwd()`, and returns exactly one fully populated `ScanResult`
- Reads `context.packageJson.scripts?.build`; a missing or blank (whitespace-only) script maps to `failed` ("package.json has no build script") without spawning npm (asserted by a never-called `ProcessRunner`). Otherwise runs read-only `npm run build` (file `npm`, args `["run", "build"]`, scan `cwd`) through `ProcessRunner` with the shared 120s build timeout
- Outcome mapping: timeout → `failed` ("npm run build timed out after 120s"); non-zero exit → `failed` ("npm run build failed"); output-capture overflow (`ProcessExecutionError` reason `output_limit`) → `failed` ("npm run build failed"); zero exit → `passed` ("npm run build passed"); `ProcessStartError` and other `ProcessExecutionError` reasons → `error` ("Scanner could not complete"). `details` is always `[]` and no build stdout/stderr is rendered
- Deliberate divergence from `GitScanner`: a build timeout is a `failed` check, not `error`, per the Build fail conditions in `scanner-registry.md` and the canonical timeout summary in `cli-output-rules.md`. An inline comment marks this branch to prevent a future "consistency" regression. The `120s` in the message is derived as `PROCESS_LIMITS.BUILD_TIMEOUT_MS / 1000` rather than hardcoded
- `ScannersModule` now provides/exports `BuildScanner` alongside `GitScanner`; the `SCANNERS` injection token/wiring remains deferred to Feature 11. No scoring or reporting was added
- Added unit tests (`test/unit/scanners/build/build.scanner.spec.ts`) covering all ten registry cases (pass, missing/blank script without spawn, non-zero, timeout→failed, output-limit→failed, npm-unavailable and adapter→error, cwd/command/args/timeout shape, duration) plus a wiring test asserting `design:paramtypes` `[ProcessRunner, Clock]`; and integration tests (`test/integration/build-scanner.integration.spec.ts`) exercising a real temp project for passing build, failing build, and missing-script cases with cross-platform Node commands
- `npm run build` and `npm test` passed all 189 tests across 16 files (175 prior + 14 new). No new dependencies. Verified on Windows / Node 24.16.0 only; Node 22.12, other OSes, installed npm launchers, and packaging remain unverified. `scanner-registry.md` updated: Build scanner marked complete
- Review dispositions (`/review` on Feature 08, 2026-09-24): (#1) output-capture overflow now maps to `failed` rather than `error` per `cli-output-rules.md` §171 (a repo-owned build failure must not be labeled an internal Shipcheck error); gate impact is unchanged since both are 0/25 applicable points. (#2) Unexpected non-process throws still propagate from `run()`, matching `GitScanner`; cross-scanner isolation is deferred to Feature 12 orchestration. (#3) No live 120s timeout integration test was added — the mapping is unit-tested and the adapter's real timeout was covered in Feature 05; a real timeout would add ~120s to the suite. (#4) The integration test intentionally omits a "repository unchanged" assertion because repo-owned build scripts may have side effects per `AGENTS.md`
- Next feature: 09 Test Scanner. Feature 08 is not committed or pushed

### Feature 07 implementation and verification — 2026-09-23

- Added `GitScanner` (`src/scanners/git/git.scanner.ts`) implementing the `Scanner` contract and a new `ScannersModule` (`src/scanners/scanners.module.ts`) that imports `InfrastructureModule` and provides/exports `GitScanner`. The scanner receives `ScanContext`, never reads `process.cwd()`, and returns exactly one fully populated `ScanResult`
- Runs read-only `git rev-parse --is-inside-work-tree`, `git branch --show-current`, and `git status --porcelain` through `ProcessRunner` with the shared 10s git timeout. Work-tree check non-zero maps to `failed` ("Not a Git repository"); post-work-tree non-zero exits, spawn failures, and timeouts map to `error`; a clean tree is `passed`, a dirty tree is `failed`
- Summaries are plain text: passing reports the branch name (or `detached HEAD` when `git branch --show-current` is empty); dirty reports the changed-file count only. `details` is always `[]` — no changed file paths are returned in summaries or details
- Deferred the `SCANNERS` injection token and registry wiring to Feature 11 (Scanner Registry), per the build plan; `GitScanner` is exported for later composition. No scoring or reporting was added
- Added unit tests (`test/unit/scanners/git/git.scanner.spec.ts`) covering all registry-required cases plus `ProcessExecutionError`→`error` and timeout→`error`, with mocked `ProcessRunner`/`Clock`; and integration tests (`test/integration/git-scanner.integration.spec.ts`) exercising real temporary Git repositories for clean, dirty, and non-repo cases with isolated git config
- Fixed a strict index-access test compile error (`TS2532`) by using optional chaining on the mock call tuple. `npm run build` and `npm test` passed all 175 tests across 14 files (17 new). One pre-existing npm-subprocess infrastructure integration test timed out under 14-worker concurrency and passed in isolation (29/29 with the two new Git files) — unrelated to the Git scanner
- No new dependencies. Verified on Windows / Node 24.16.0 only; Node 22.12, other OSes, installed npm launchers, and packaging remain unverified. `scanner-registry.md` updated: Git scanner marked complete
- Next feature: 08 Build Scanner. Feature 07 is not committed or pushed

### Feature 06 implementation and verification — 2026-09-22

- Added `ProjectDiscoveryError` (safe fixed messages plus internal cause) and imported `InfrastructureModule` into `ScanModule` so `ScanService` injects `FileSystem`. `ScanService.discover()` resolves `process.cwd()` once, reads only `<cwd>/package.json`, and never walks parent directories
- Discovery narrows untrusted JSON into the validated `PackageJson` projection (string `name`; `scripts.build`/`scripts.test` only), omitting non-string fields, and applies the directory-basename fallback when `name` is missing or blank. It builds the immutable `ScanContext`; `scan()` now awaits `discover()` before returning the temporary failed-gate shell result
- Fatal discovery outcomes map to distinct safe stderr messages and exit `2`: missing (`package.json was not found.`), invalid (`package.json is not valid JSON.`), and unreadable, each followed by `Run the command from the root of a Node.js project.`; `bootstrap` recognizes `ProjectDiscoveryError` and a generic error still yields the generic fatal message. Both new canonical messages were documented in `cli-output-rules.md`
- `exactOptionalPropertyTypes` rejected the initial builder type that unioned `undefined` into the optional `scripts` projection; typed the builder/`projectScripts` return without the explicit `undefined` union so it assigns to `PackageJson`. No other correction was needed
- Added ScanService unit tests (valid package, missing file, invalid JSON, non-object root, name/basename fallbacks), a bootstrap unit test for `ProjectDiscoveryError` stderr/exit `2`, and rewrote the integration discovery cases (missing → exit 2 + not-found + directory unchanged; invalid → exit 2 + invalid-JSON + byte-identical file + no leakage; valid → shell exits 0/1 + no mutation)
- `npm run build` and `npm test` with the standard pipeline passed production/test compilation and all 158 tests across 12 files. Manual smoke test from a temp directory confirmed exit 2 (missing), exit 2 (invalid JSON), and exit 0/1 (valid) with the expected messages
- No new dependencies. No scanners, scoring, or reporting were added; infrastructure adapters other than `FileSystem` remain unwired. Verified on Windows / Node 24.16.0 only; Node 22.12, other OSes, installed npm launchers, and packaging remain unverified. `scanner-registry.md` verified accurate: all four scanners and the registry provider remain not started
- Next feature: 07 Git Scanner. Feature 06 is not committed or pushed

### Feature 05 implementation and verification — 2026-09-21

- Added process request/result contracts, safe ProcessStartError/ProcessExecutionError, centralized execution limits, and injectable ProcessRunner/FileSystem/Clock exported by InfrastructureModule. The temporary ScanService remains unchanged and no dependency was added
- ProcessRunner preserves ordinary exits, normalizes timeouts to synthetic exit 1, distinguishes operational failures, captures at most 1,000,000 bytes per stream, closes stdin, and keeps parent/request environments unchanged. Windows lookup prevents missing executable fallback from masquerading as a repository failure; read-only filesystem access is centralized
- Installed Execa 10.0.1 types/source and versioned documentation were inspected. Its full result generic conflicted under exactOptionalPropertyTypes; a private Pick of consumed result fields avoids widening public types or using a production assertion. Exported runner declarations contain only project-owned process contracts
- Native checks exercise actual Node output/exits, literal arguments/stdin EOF, unavailable command/cwd, timeouts, Unicode output limits, npm build/test in a path with spaces, environment preservation, npm descendant cleanup, filesystem reads, and production Nest injection. Mocked tests cover access denial, signals/cancellation, I/O failures, malformed results, Windows lookup policies, and safe error messages
- Initial sandbox execution passed 63/64 focused checks but denied taskkill, leaving the npm tree alive. Confirmed Windows Access denied, identified only fixture-owned ancestry, and cleaned it up with normal process permissions. All 64 focused checks then passed outside the sandbox. The fixture now records both script/child IDs and has an independent deadline/emergency cleanup
- The first full-suite run passed 138/139 checks: npm's two-second timeout expired before the tree script created its PID marker under parallel load. Used recover to isolate this test timing issue and aligned the fixture timeout with the existing ten-second npm smoke allowance. The complete rerun passed production/test compilation and all 139 tests across 11 files with NO_COLOR=1 and normal Windows process-management permissions
- Scoped review covered plan alignment, error/output safety, dependency boundaries, environment immutability, DI, and integration evidence. No actionable findings remained. Scanner registry verified accurate: all four scanners and registry provider are still not started. Existing 75 CLI/domain checks remain passing
- Limits: verification used Windows / Node 24.16.0; minimum Node 22.12, POSIX native signal/process-group behavior, and installed Shipcheck packaging remain unverified. Arbitrary Windows shebang/batch launchers and metadata-denied App Execution Aliases are unsupported. Descendant cleanup is best-effort; when taskkill is denied, inherited pipes may delay settlement. This is not a sandbox or hard wall-clock deadline
- Next feature: 06 Project Discovery and Scan Context. Feature 05 is not committed or pushed; memory.md was consolidated at the user's save request after implementation and review

### Approved Windows launcher clarification for Feature 05 — 2026-09-21

- Original architecture said “Never execute through a shell”; code standards require separate executable/arguments and prohibit shell:true
- Installed Execa 10.0.1 uses cmd.exe internally for npm.cmd even when the caller sets shell:false. Its ordinary Windows missing-command fallback can also return exit 1 with no ENOENT, so the plan includes read-only executable lookup before launch
- Approved clarification: permit Execa's internal Windows npm launcher while Shipcheck continues using separate file/argument values, shell:false, and no explicit shell command construction. This preserves the installed npm launcher behavior without inventing version-manager/npm layouts
- The user authorized the recommended approach and implementation. Architecture and standards now allow this narrow exception; unsupported Windows shebang/batch launchers and App Execution Aliases that deny metadata access fail safely
- Full design, failure mapping, byte-limit handling, cleanup limits, proposed files, and verification are in feature 05 of the build plan

### Feature 04 implementation — 2026-09-21

- Added the Scanner interface and separate ScannerId, ScanStatus, ReadinessStatus, PackageJson, ScanContext, ScanResult, and ScanReport types under `src/common/`. Domain types import no framework/presentation libraries
- ScannerId derives from the frozen `SCAN_ORDER` tuple. Frozen `SCANNER_WEIGHTS` covers exactly four IDs at 25 points each, with READY/REVIEW thresholds centralized at 90/70. Existing EXIT_CODE values are unchanged
- PackageJson is a readonly validated subset, not untrusted JSON. Future discovery must narrow/select supported string fields; it will omit non-string fields and retain documented name fallback/missing-script behavior. No parser or new fatal metadata rule was implemented
- Context and nested package metadata are readonly through TypeScript. Result/report fields remain required with number-valued duration/weight/score; runtime ranges, score/gate consistency, and report completeness remain subsequent provider responsibilities
- Removed ScanShellReport and migrated the shell service, exit selector, and test consumers to `Pick<ScanReport, "gatePassed">`. The shell still returns a failed gate, performs no checks, and prints no report; local/CI exits remain 0/1
- Removed six obsolete generated artifacts for the deleted temporary type after checking absolute workspace paths. Inspected declarations and verified no old temporary-type references remain in source/tests/generated output
- Added five policy invariant tests and compiler-only positive/negative examples in `test/typechecks/domain-contracts.ts`. The uncalled examples cover valid contracts, closed IDs/statuses, required fields, async scanner behavior, readonly fields, typed package metadata, weight-key coverage, and full-report compatibility with the exit selector
- `npm test` with NO_COLOR=1 passed production/test builds, all expected type rejections, and 75 tests across seven files. The existing compiled CLI suite confirms unchanged help, parsing, shell exits, error safety, and cleanup. No additional manual CLI smoke was repeated because public behavior did not change
- A patch operation partially applied before failing to create `src/common/contracts`. Inspected the exact landed files, created the missing directory, and applied only the remaining edits successfully. No recurring failure or application correction was needed
- Review checked plan alignment, contract boundaries, emitted declarations, migration, and regression coverage. No actionable findings. `git diff --check` passed; scanner registry still accurately marks all four scanners and their provider registry as not started
- No dependency/configuration changes. Verified on Windows / Node 24.16.0 only; minimum Node, other OSes, installed npm launchers, packaging, and real scan/report fixtures remain unverified

### Feature 03 implementation — 2026-09-21

- Registered `ScanCommand` with typed boolean `--ci`, explicit child argument rejection, `ScanModule`/`ScanService`, temporary `ScanShellReport`, and a pure command-layer exit selector using existing constants
- Temporary service returns `{ gatePassed: false }`, emits no report, and does not discover projects, spawn commands, or evaluate checks. Local/CI shell exits are `0`/`1`; README documents the development limitation. Full domain contracts remain feature 04
- Installed nest-commander 3.21.0 independently constructs child commands; root exit override/strictness do not propagate, and `allowExcessArgs: false` metadata does not disable the permissive default. Applied explicit `setCommand()` configuration
- Replaced root-only parser signal capture with a shared throwing `ParserExitSignal` boundary for root and scan. Bootstrap recognizes only the project-owned wrapper, preserves command exits after cleanup, and still rejects ordinary errors resembling successful parser signals
- Updated help documentation to the observed framework order (Options before Commands) without a custom renderer or expanded command surface
- `npm test` with `NO_COLOR=1` passed production build, test compilation, and all 70 tests across six files, including seven new command unit/DI cases and 25 new compiled scan cases
- New cases cover actual option forwarding, ambient CI independence, all four gate/exit combinations, awaiting the service, strict arguments/options, child help, asynchronous shutdown, service rejection/lookalike errors, cleanup override, and no target discovery/mutation
- Manual compiled root help, scan help, version, local/CI shell, and invalid scan option checks matched expected output and exits; `git diff --check` passed
- Review covered plan alignment, provider boundaries, parser/cleanup behavior, output safety, and regression coverage. No actionable findings within feature 03 scope. Scanner registry accuracy verified: all four scanners and their registry remain not started
- No dependency changes. Verified on Windows / Node 24.16.0 only; Node 22.12, other OSes, installed npm launchers, packaging, and real scan/report fixtures remain unverified

### Approved feature 02/03 sequencing adjustment — 2026-09-20

- The user approved moving “root help lists the scan command” from feature 02 acceptance to feature 03, where `ScanCommand` is introduced
- Reason: requiring the command in feature 02 conflicts with sequential feature ownership and would require premature scan registration or misleading help
- Feature 02 owns product-named help, package-derived version, safe usage/bootstrap exit behavior, and lifecycle verification; feature 03 completes the final help surface with `scan` and `--ci`
- Updated `build-plan.md` and `cli-output-rules.md`; the final v0.1 public surface is unchanged
- The detailed feature 02 architecture plan is recorded in `build-plan.md`, including installed API findings, proposed paths, ordered work, acceptance criteria, and verification
- The initial adjustment was documentation only; feature 02 was subsequently implemented and verified as recorded above
- Scanner behavior and implementation status remain unchanged; all four scanner entries remain accurate

If implementation must differ from the context pack:

1. Stop before making the conflicting change
2. Record the proposed deviation here
3. Explain why the current design cannot be followed
4. Update every affected context file after approval
5. Continue only when the documents are consistent again

---

## Notes

- Public npm publication is outside v0.1 implementation scope
- `npm pack --dry-run` and temporary local installation are required packaging checks
- New scanners, output formats, config files, and package managers belong to later versions
- Do not convert roadmap ideas into TODO comments in production code

---

## Session Handoff Template

Complete this section before ending an implementation session:

```text
Date:
Completed feature:
Files changed:
Tests run and results:
Manual verification:
Decision or deviation recorded:
Next feature:
Known blocker:
```

### Latest Handoff

```text
Date: 2026-10-04
Completed feature: 17 Executable and Package Smoke Test
Files changed: package.json, test/helpers/package-smoke.ts (new), test/helpers/project-fixture.ts, test/unit/scaffold.spec.ts, README.md, context/build-plan.md, context/progress-tracker.md, context/library-docs.md, context/scanner-registry.md
Tests run and results: fresh production/test compilation passed; installed package check passed (51 files/offline reinstall); empty offline cache correctly failed; full 376 tests across 30 files passed
Review: no actionable findings within scope; final package rerun and git diff --check passed
Verification: actual npm launcher help/version, READY and failed-build local/CI, fatal exits, exact safe reports/streams and fixture/Git preservation
Verification limits: macOS / Node 24.21.0 / npm 11.19.0; Windows/Linux/minimum Node unverified
Decision recorded: JS distribution plus mandatory metadata; explicit registry preparation before offline verification; standalone runner outside Vitest; no chmod needed
Next feature: 18 Documentation and v0.1 Release Candidate
Known blocker: None. Uncommitted
```

### Previous Handoff — Feature 16

```text
Date: 2026-10-03
Completed feature: 16 Integration Fixture Suite
Files changed: test/fixtures/projects/* (new), test/helpers/project-fixture.ts (new), test/integration/project-fixtures.integration.spec.ts (new), README.md, context/build-plan.md, context/progress-tracker.md, context/scanner-registry.md, context/library-docs.md
Tests run and results: production/test compilation passed; 16 focused fixture checks passed twice; NO_COLOR=1 npm test -- --maxWorkers=4 passed all 376 tests across 30 files; git diff --check passed
Manual verification: compiled CLI on temporary ready/failing-build fixtures in CI — 100 READY exit 0 and 75 REVIEW exit 1; later scanners continued, stderr empty
Review: no actionable findings within scope
Verification limits: macOS / Node 24.21.0 / npm 11.19.0; Windows/Linux/minimum Node and installed packaging remain unverified
Decision or deviation recorded: ESM .mjs fixture scripts; Vitest concurrent:false suite option; distinct isolated npm user/global config paths
Next feature: 17 Executable and Package Smoke Test
Known blocker: None. Uncommitted
```

### Previous Handoff — Feature 12

```text
Date: 2026-10-01
Completed feature: 12 Scan Orchestration
Files changed: src/scan/scan.service.ts, src/scan/scan.module.ts, test/unit/scan/scan.service.spec.ts, test/unit/commands/scan.command.spec.ts, test/unit/scanners/scanners.module.spec.ts, test/unit/scaffold.spec.ts, test/helpers/scan-probe.ts, test/helpers/scan-orchestration-probe.ts (new), test/integration/scan-command.integration.spec.ts, test/integration/scan-orchestration.integration.spec.ts (new), README.md, context architecture/output-rules/library/registry/build-plan/tracker documents
Tests run and results: production/test compilation passed; 77 focused checks across 7 files passed; NO_COLOR=1 npm test -- --maxWorkers=4 passed all 336 tests across 28 files; git diff --check passed
Manual verification: compiled CLI on a scratch npm/Git project — dirty tree (local 0, CI 1), clean READY (CI 0), missing environment names (CI 1, names only, empty stderr, tree unchanged); PTY run showed per-scanner spinners cleared before the colored report
Review: one hardening finding (explicit score/status/gate copy) applied; scanner registry entry updated
Verification limits: macOS / Node 24.21.0; Windows/minimum Node, full exit matrix, representative fixtures and installed packaging remain pending
Decision or deviation recorded: compiled Nest test modules override REPORTER_VERSION; tests never scan Shipcheck's own repository
Next feature: 15 CI Exit Enforcement
Known blocker: None. Not committed
```

### Previous Handoff — Feature 14

```text
Date: 2026-10-01
Completed feature: 14 Terminal Reporter
Files changed: src/reporter/*, reporter unit/integration tests and helpers, test/fixtures/reporter/*.txt, package.json, package-lock.json, context architecture/output/library/build-plan/tracker documents
Tests run and results: production/test compilation passed; 47 focused reporter checks passed; NO_COLOR=1 npm test -- --maxWorkers=4 passed all 322 tests across 27 files; git diff --check passed
Manual verification: native ESM imports; real PTY local progress/style and cleanup before report/on module close; plain CI and empty NO_COLOR; 80-column output. Native production probes render from unrelated cwd with separate stdout/stderr assertions
Review: no actionable findings within scope; scanner registry verified unchanged and accurate
Verification limits: macOS / Node 24.21.0; Windows/minimum Node, full pipeline, command report-before-exit verification and installed packaging remain pending
Decision or deviation recorded: implemented planned reporter API with awaited report(), exact direct Chalk/Ora versions, isolated stream writer helper, documented formatting interpretations. ReporterModule remains outside ScanModule until Feature 12
Next feature: 12 Scan Orchestration
Known blocker: None; this handoff precedes the requested commit/push. Check Git history/status for the resulting revision
```

### Previous Handoff — Feature 13

```text
Date: 2026-09-28
Completed feature: 13 Scoring Service
Files changed: src/scoring/scoring.service.ts (new), src/scoring/scoring.module.ts (new), test/unit/scoring/scoring.service.spec.ts (new), context/build-plan.md, context/progress-tracker.md
Tests run and results: npm run build and npm run test:compile passed; 23 focused scoring checks passed; NO_COLOR=1 npm test -- --maxWorkers=4 passed compilation and all 275 tests across 23 files; git diff --check passed
Manual verification: review covered plan alignment, provider boundaries, trust assumptions, skipped/error behavior, rounding/thresholds, gate mapping, input immutability, export visibility and test coverage; no actionable findings. Scanner registry remains accurate. No user-visible behavior change requiring a manual CLI smoke test
Verification limits: Windows / Node 24.16.0 only; minimum Node 22.12, other OSes, full scan/report integration and installed packaging remain unverified
Decision or deviation recorded: user approved Phase 4 order 13 → 14 → 12 → 15; scoring follows the plan without dependency changes. Full tests used normal Windows process permissions. ScoringModule is exported but not imported into ScanModule until Feature 12. memory.md consolidated before the user-requested commit/push on 2026-09-28; check Git history/status for the resulting revision rather than replaying this historical request
Next feature: 14 Terminal Reporter
Known blocker: None
```

### Previous Handoff — Feature 11

```text
Date: 2026-09-27
Completed feature: 11 Scanner Registry
Files changed: src/scanners/scanner.tokens.ts (new), src/scanners/scanners.module.ts, src/scan/scan.module.ts, test/unit/scanners/scanners.module.spec.ts (new), test/helpers/scanner-registry-probe.ts (new), test/integration/scanner-registry.integration.spec.ts (new), context/build-plan.md, context/architecture.md, context/library-docs.md, context/scanner-registry.md, context/progress-tracker.md
Tests run and results: production/test builds passed; seven focused registry checks passed; NO_COLOR=1 npm test -- --maxWorkers=4 passed 252 tests across 22 files (245 prior + seven new); git diff --check passed
Manual verification: scoped code review found no actionable findings; automated native production probe verifies ordered provider identity, successful exit and clean streams; existing CLI regressions passed
Verification limits: Windows / Node 24.16.0 only; Node 22.12, other OSes, full scan/report pipeline and installed packaging remain unverified
Decision or deviation recorded: fixed Scanner[] factory reuses singleton providers; concrete exports retained; ScanModule imports ScannersModule; ScanService injection/execution remains Feature 12; no dependency change. Full tests used normal Windows process permissions. Feature 11 committed as 24c0b6a and pushed to origin/main on 2026-09-27; this handoff update follows that push
Next feature: 12 Scan Orchestration
Known blocker: None
```
