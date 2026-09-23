# Progress Tracker

Update this file after every completed feature. Any engineer or AI agent reading it should immediately know what is complete, what is being worked on, and what comes next.

---

## Current Status

**Version:** v0.1.0

**Phase:** Phase 3 — Scanners

**In progress:** None

**Last completed:** 07 Git Scanner

**Next:** 08 Build Scanner

**Blockers:** None recorded

**Feature 03:** Implemented and verified on 2026-09-21 against the architecture plan in `build-plan.md`. The shell performs no real checks or reporting yet; local/CI exits are `0`/`1` with the temporary failed-gate result.

**Feature 04:** Implemented and verified on 2026-09-21 against the plan in `build-plan.md`: complete domain contracts, canonical IDs/order/weights/thresholds, and migration from the temporary shell type to a gate projection of `ScanReport`. Real report assembly and scanner execution remain later features.

**Feature 05:** Implemented and verified on 2026-09-21 against the approved plan. Production/test compilation and all 139 tests across 11 files passed on Windows / Node 24.16.0. The user approved Execa's internal Windows npm.cmd launcher while retaining shell:false and separate executable/argument values. No scanner or scan-shell integration was added.

**Feature 06:** Implemented and verified on 2026-09-22 against the approved plan. `ScanService` now injects `FileSystem`, resolves `process.cwd()` once, reads and validates `<cwd>/package.json` (no parent traversal), narrows the untrusted JSON into the `PackageJson` projection, applies directory-basename fallback for a missing/blank name, and builds an immutable `ScanContext`. Fatal discovery errors (missing/invalid/unreadable `package.json`) surface a safe concise stderr message and exit `2` via `ProjectDiscoveryError` in `bootstrap`. Production build and all 158 tests across 12 files passed on Windows / Node 24.16.0. No scanners, scoring, or reporting were added; valid targets still return the temporary failed-gate shell result.

**Feature 07:** Implemented and verified on 2026-09-23 against the approved plan. `GitScanner` (`src/scanners/git/git.scanner.ts`) implements the `Scanner` contract (`id: "git"`, `name: "Git"`, weight from `SCANNER_WEIGHTS.git`) and runs read-only `git rev-parse --is-inside-work-tree`, `git branch --show-current`, and `git status --porcelain` via `ProcessRunner` under the 10s git timeout. Work-tree check failure maps to `failed` ("Not a Git repository"); post-work-tree execution failures and timeouts map to `error`; canonical clean/dirty summaries report the branch name (or `detached HEAD`) and dirty-file count only, with `details: []` (no changed paths leaked). New `ScannersModule` provides/exports `GitScanner`. Production build and all 175 tests across 14 files passed on Windows / Node 24.16.0 (17 new Git cases). The `SCANNERS` registry token is deferred to Feature 11; no scoring or reporting was added.

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
- [ ] 08 Build Scanner
- [ ] 09 Test Scanner
- [ ] 10 Environment Scanner
- [ ] 11 Scanner Registry

### Phase 4 — Orchestration and Reporting

- [ ] 12 Scan Orchestration
- [ ] 13 Scoring Service
- [ ] 14 Terminal Reporter
- [ ] 15 CI Exit Enforcement

### Phase 5 — Verification and Packaging

- [ ] 16 Integration Fixture Suite
- [ ] 17 Executable and Package Smoke Test
- [ ] 18 Documentation and v0.1 Release Candidate

---

## Scanner Status

| Scanner     | Implementation | Unit tests | Integration coverage | Registry updated |
| ----------- | -------------- | ---------- | -------------------- | ---------------- |
| Git         | Complete       | Complete   | Complete             | Complete         |
| Build       | Not started    | Not started| Not started          | Not started      |
| Tests       | Not started    | Not started| Not started          | Not started      |
| Environment | Not started    | Not started| Not started          | Not started      |

---

## Quality Gate Status

| Gate                       | Status      | Last verified |
| -------------------------- | ----------- | ------------- |
| TypeScript build           | Passed (production/test compilation, domain contract checks, and GitScanner sources) | 2026-09-23 |
| Unit tests                 | Passed (prior checks plus new GitScanner cases with mocked ProcessRunner/Clock) | 2026-09-23 |
| Integration tests          | Passed (prior discovery checks plus real temp-repo GitScanner clean/dirty/non-repo cases); other real scan fixtures pending | 2026-09-23 |
| Help/version smoke test    | Root/scan help and version passed; invalid usage returns 2 | 2026-09-21 |
| Local scan smoke test      | Valid target discovered, shell exit 0; real pipeline pending | 2026-09-22 |
| CI exit-code smoke test    | Valid target shell exit 1 passed; discovery failures exit 2; real report enforcement pending | 2026-09-22 |
| Package dry run            | Not started | —             |
| Secret-leak negative check | Passed for bootstrap, scan shell, discovery, and GitScanner (dirty summary/details omit changed paths); remaining scanner checks pending | 2026-09-23 |
| Shipcheck-owned mutation check | Passed for help/version, scan shell, discovery, and GitScanner (read-only git commands leave the repo unchanged); remaining scan checks pending | 2026-09-23 |

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
Date: 2026-09-23
Completed feature: 07 Git Scanner
Files changed: src/scanners/git/git.scanner.ts (new), src/scanners/scanners.module.ts (new), test/unit/scanners/git/git.scanner.spec.ts (new), test/integration/git-scanner.integration.spec.ts (new), context/scanner-registry.md, context/progress-tracker.md
Tests run and results: npm run build passed; npm test passed all 175 tests across 14 files (158 prior + 17 new). One pre-existing npm-subprocess infrastructure integration test timed out under full-suite concurrency and passed in isolation (29/29) — unrelated to the Git scanner
Manual verification: integration tests run real temporary Git repositories for clean (passed), dirty (failed, count only), and non-repo (failed, "Not a Git repository") cases; dirty summary/details omit the changed filename and the read-only git commands leave the repo unchanged
Verification limits: Windows / Node 24.16.0 only; Node 22.12, other OSes, installed npm launcher/packaging remain unverified
Decision or deviation recorded: SCANNERS registry token and wiring deferred to Feature 11; strict index-access test compile error fixed with optional chaining
Next feature: 08 Build Scanner
Known blocker: None
```
