# Progress Tracker

Update this file after every completed feature. Any engineer or AI agent reading it should immediately know what is complete, what is being worked on, and what comes next.

---

## Current Status

**Version:** v0.1.0

**Phase:** Phase 2 — Core Contracts and Infrastructure

**In progress:** None

**Last completed:** 03 Scan Command Shell

**Next:** 04 Domain Contracts and Constants

**Blockers:** None recorded

**Feature 03:** Implemented and verified on 2026-09-21 against the architecture plan in `build-plan.md`. The shell performs no real checks or reporting yet; local/CI exits are `0`/`1` with the temporary failed-gate result.

---

## Progress

### Phase 1 — Foundation

- [x] 01 Project Scaffold
- [x] 02 Nest Standalone CLI Bootstrap
- [x] 03 Scan Command Shell

### Phase 2 — Core Contracts and Infrastructure

- [ ] 04 Domain Contracts and Constants
- [ ] 05 Infrastructure Adapters
- [ ] 06 Project Discovery and Scan Context

### Phase 3 — Scanners

- [ ] 07 Git Scanner
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
| Git         | Not started    | Not started| Not started          | Not started      |
| Build       | Not started    | Not started| Not started          | Not started      |
| Tests       | Not started    | Not started| Not started          | Not started      |
| Environment | Not started    | Not started| Not started          | Not started      |

---

## Quality Gate Status

| Gate                       | Status      | Last verified |
| -------------------------- | ----------- | ------------- |
| TypeScript build           | Passed (production and test compilation) | 2026-09-21 |
| Unit tests                 | Passed (6 scaffold, 4 bootstrap boundary, 7 command/DI checks) | 2026-09-21 |
| Integration tests          | Passed (20 bootstrap CLI, 8 native metadata, 25 scan shell checks); real scan fixtures pending | 2026-09-21 |
| Help/version smoke test    | Root/scan help and version passed; invalid usage returns 2 | 2026-09-21 |
| Local scan smoke test      | Shell only passed, exit 0; real pipeline pending | 2026-09-21 |
| CI exit-code smoke test    | Shell exit 1 passed; injected gate exit matrix passed; real report enforcement pending | 2026-09-21 |
| Package dry run            | Not started | —             |
| Secret-leak negative check | Passed for bootstrap, scan shell parser/service failures; scanner checks pending | 2026-09-21 |
| Shipcheck-owned mutation check | Passed for help/version and scan shell; real scan checks pending | 2026-09-21 |

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
Date: 2026-09-21
Completed feature: 03 Scan Command Shell
Files changed: src/bootstrap.ts, src/commands/*, src/scan/*, test/unit/commands/scan.command.spec.ts, test/integration/bootstrap.integration.spec.ts, test/integration/scan-command.integration.spec.ts, test/helpers/scan-probe.ts, README.md, context/architecture.md, context/library-docs.md, context/build-plan.md, context/cli-output-rules.md, context/progress-tracker.md
Tests run and results: npm test with NO_COLOR=1 passed production build, test compilation, and all 70 tests (6 files)
Manual verification: root/scan help and version exit 0; local shell exits 0; CI shell exits 1; invalid scan option exits 2 with safe stderr; git diff --check passed
Verification limits: Windows / Node 24.16.0 only; Node 22.12, other OSes, installed npm launcher/packaging, and real scan fixtures remain unverified
Decision or deviation recorded: shared parser wrapper protects child-command cleanup; explicit child argument rejection; temporary failed-gate result with no report or real checks
Next feature: 04 Domain Contracts and Constants; replace temporary ScanShellReport with full report contract and reuse existing EXIT_CODE constants
Known blocker: None
```
