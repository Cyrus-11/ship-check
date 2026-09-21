# Build Plan

## Core Principle

Build the public CLI contract first, then implement one vertical slice at a time. Every feature must include its observable terminal behavior, exit behavior where relevant, and automated tests before the next feature starts.

Shipcheck v0.1 is complete only when the compiled executable can scan isolated fixture repositories. A collection of services that has never been exercised through `shipcheck scan` is not a finished CLI.

---

## Working Rules

- Complete features in numerical order
- Read the relevant context section before coding
- Update `progress-tracker.md` after each completed feature
- Update `scanner-registry.md` after each scanner is completed
- Run build and tests after every feature
- Do not begin roadmap work while v0.1 items remain
- Do not publish to npm during this plan

---

## Phase 1 — Foundation

### 01 Project Scaffold

Create the minimal Node.js, TypeScript, and NestJS CLI project.

**Implementation:**

- Create npm package named `shipcheck` at version `0.1.0`
- Set Node engine to `>=22.12.0`
- Configure native ESM with `type: module`
- Add TypeScript strict and NodeNext configuration
- Add `tsconfig.build.json`
- Install only dependencies approved in `library-docs.md`
- Create `src/main.ts` with Node shebang
- Create `src/app.module.ts`
- Add build, test, and development scripts
- Add `.gitignore`, README shell, and MIT license if licensing is confirmed

**Acceptance:**

- `npm install` completes without engine warnings on the supported Node version
- `npm run build` emits `dist/main.js`
- Compiled entry point retains the shebang
- `node dist/main.js --help` starts without an HTTP server
- No unused web dependencies are present

**Tests:**

- Build smoke check
- Package metadata assertions for `type`, `bin`, `engines`, and version

---

### 02 Nest Standalone CLI Bootstrap

Connect `nest-commander` to the Nest application context.

**Status:** Implemented and verified on 2026-09-20. Production/test builds and all 38 tests passed; feature 03 is next.

**Approved sequencing adjustment — 2026-09-20:**

The user approved moving the acceptance criterion that root help lists `scan` to feature 03, which introduces `ScanCommand`. Feature 02 establishes product help/version, usage errors, and application lifecycle behavior. It does not register or advertise a placeholder scan command. The final v0.1 help contract is unchanged.

**Outcome and scope:**

- Product-named help and package-derived version work from any working directory
- Help/version and invalid usage finish output and application cleanup before termination
- Startup failures produce a concise safe message and exit `2`
- Scan execution, `--ci`, discovery, scanners, scoring, and report rendering remain later features
- Keep the installed dependency set and Node 22.12+ baseline; no new dependency is needed

**Installed API findings:**

- Nest common/core/testing are 11.2.5; nest-commander is 3.21.0 and wraps Commander 11.1.0
- `cliName` does not set the root command's displayed name; use nest-commander's `@RootCommand()` metadata for name and description
- `CommandFactory.run()` closes the initialized application in `finally` after command execution
- The factory's `errorHandler` is passed to Commander's `exitOverride`; returning from that callback still reaches `process.exit()` in the installed Commander implementation
- Command parsing catches errors through `serviceErrorHandler`; its default writes the error directly, so both handlers need deliberate configuration
- Application creation occurs before the factory's execution `try/finally`; distinguish startup failure handling from cleanup of an already initialized context
- The original illustrative error handlers in `architecture.md` and `library-docs.md` were replaced with the verified lifecycle pattern

These findings were checked against installed source/types and the official [factory](https://nest-commander.jaymcdoniel.dev/en/features/factory/) and [command](https://nest-commander.jaymcdoniel.dev/en/features/commander/) documentation. The installed implementation governs version-specific behavior.

**Implemented areas:**

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | Preserve shebang and metadata import; invoke bootstrap once |
| `src/bootstrap.ts` | Configure the factory, handle exit signals and fatal failures, expose a narrow testing seam |
| `src/app.module.ts` | Import `CommandsModule` |
| `src/commands/commands.module.ts` | Register the root command provider |
| `src/commands/root.command.ts` | Product metadata, root help, and strict argument handling |
| `src/common/package-version.ts` | Load and validate Shipcheck's own package version |
| `src/common/constants/exit-codes.ts` | Shared exit constants introduced at first use; feature 04 reuses them |
| `test/unit/bootstrap.spec.ts` | Safe failure handling and preservation of command exit decisions |
| `test/integration/bootstrap.integration.spec.ts` | Compiled CLI streams, exits, working-directory independence, and lifecycle |
| `test/integration/package-version.integration.spec.ts` | Native Node package-version validation |
| `test/helpers/` | Isolated lifecycle/failure probes alongside the existing network-listener guard |

**Ordered implementation:**

1. Add `CommandsModule` and a `@RootCommand()` provider named `shipcheck`, with description `Check whether a Node.js project is ready to ship`. Register it through `AppModule`. Configure the framework-owned command instance to reject excess arguments and disable the implicit `help` subcommand. A bare invocation prints root help and exits `0`; it never starts a scan.
2. Load Shipcheck's own package metadata using a package-relative ESM URL and JSON import attributes, independent of `process.cwd()`. Validate that the version is a non-empty string; do not fall back to a duplicated literal. Keep this read separate from future scanned-project file access. Exercise the real loader through `dist/`; account explicitly for the different `.test-dist/` layout in isolated tests.
3. Extract a small bootstrap function and retain one `CommandFactory.run()` call with `cliName: "shipcheck"`, the loaded version, `usePlugins: false`, `logger: false`, and `abortOnError: false`. No second Nest context or `runWithoutClosing`.
4. Make `errorHandler` throw the framework exit signal so its callback cannot fall through to `process.exit()`. In `serviceErrorHandler`, recognize help/version success signals, classify parser usage failures as exit `2`, and propagate unexpected execution failures to the outer bootstrap boundary. Narrow unknown values without importing Commander as a separate application layer. Avoid duplicate diagnostics.
5. Catch metadata, factory startup, unexpected execution, and cleanup failures at the bootstrap boundary. Print a fixed safe startup/execution message to stderr, never an arbitrary error message or stack, and select exit `2`. Allow factory cleanup and buffered output to finish; a cleanup failure must override an otherwise successful exit. Keep exit decisions within command/bootstrap code.
6. Add focused behavioral tests using the existing tsc-before-Vitest toolchain. Use test-only injected failures and lifecycle probes; do not add production failure flags or environment switches.
7. Run verification, update the illustrative bootstrap documentation to match the actual implementation, and record evidence in the tracker. Confirm all scanner-registry entries remain accurate before marking feature 02 complete.

**Acceptance and verification:**

| Scenario | Observable result |
| --- | --- |
| `--help` and `-h` | `Usage: shipcheck [options]`, exact product description, help/version options, stdout, empty stderr, exit `0` |
| `--version` and `-V` | Current package version only with a trailing newline, stdout, empty stderr, exit `0` |
| No arguments | Root help on stdout, exit `0` |
| Unknown flag, unknown command, or positional path | Concise usage diagnostic on stderr, exit `2`, no successful command execution |
| Help/version from an unrelated temporary directory | Same output and version even without a project manifest or with a different project's version |
| Metadata load failure or Nest startup rejection | Safe stderr, exit `2`, no stack, serialized error, or injected secret marker |
| Unexpected execution or cleanup failure | Safe stderr, exit `2`; initialized application cleanup is attempted |
| Help/version and usage-error lifecycle | Test probe observes completed asynchronous shutdown hooks exactly once; subprocess terminates within the test timeout |
| All compiled CLI cases | No Nest logs, network listener, ANSI/spinner artifacts, or HTTP adapter |

- Assert stdout, stderr, and exit code separately; preserve existing scaffold checks
- Run `npm test` with `NO_COLOR=1`; its existing pretest runs the production build and test compilation
- Manually smoke-test `node dist/main.js --help`, `--version`, and one invalid option, checking exit codes
- Run `git diff --check`
- Record platform evidence honestly: the available environment is Windows / Node 24.16.0; minimum-Node and other-OS execution require those environments
- Installed npm launcher and full packaging smoke tests remain feature 17

**Completion:** No unresolved feature 02 decisions. Root-command configuration and asynchronous lifecycle passed compiled-executable tests. Metadata tests use native Node because Vitest's data-URL import path lost JSON attributes. See the tracker for verification evidence and platform/packaging limits.

---

### 03 Scan Command Shell

Add the public command without real scanners.

**Status:** Implemented and verified on 2026-09-21. Production/test builds and all 70 tests across six files passed on Windows / Node 24.16.0. Feature 04 is next. The architecture plan below records the chosen design and verification criteria.

**Restored baseline:** Features 01 and 02 are implemented. Local `main` is at `b1929e0` (the feature 02 memory commit); compared with memory's recorded `1ca408b`, only `memory.md` changed. The working tree was clean before this planning update. Memory's claim that its save is uncommitted is superseded. The earlier 38-test pass is historical evidence; tests were not rerun during planning.

**Outcome and scope:**

- Register `shipcheck scan` and its single product option, boolean `--ci`, and complete root/scan help
- Prove option normalization, service injection, centralized exit selection, safe parser errors, and asynchronous cleanup through the compiled executable
- Keep the existing dependencies and Node baseline
- Discovery, project-file reads, subprocess execution, four-scanner registration, scoring, and terminal reports remain their later features
- Feature 15 will verify exits against real rendered reports; feature 03 establishes the command boundary using a temporary service result

**Installed API findings and design decisions:**

- Manifest, lockfile, and installed package agree on nest-commander 3.21.0, Commander 11.1.0, and Nest 11.2.5. No applicable installed Nest/Commander skill or documentation MCP was found. Reviewed the official [command](https://nest-commander.jaymcdoniel.dev/en/features/commander/) and [factory](https://nest-commander.jaymcdoniel.dev/en/features/factory/) documentation and [Commander 11.1.0](https://github.com/tj/commander.js/tree/v11.1.0), then checked installed source/types for version-specific behavior.
- `@Command()` supplies injectable command metadata; register `ScanCommand` as a provider in `CommandsModule`, importing a small `ScanModule` that exports `ScanService`. Keep the existing root command and single factory bootstrap.
- Use `@Option({ flags: "--ci", description: "Enforce the release gate through process exit codes" })` with a parser returning `true`. Do not define a value argument, alias, negated option, default, or environment binding. Normalize absent options with `options.ci === true`; ambient `CI` does not enable the CLI flag.
- nest-commander constructs each command independently and attaches it with `addCommand()`. Root strictness and the root exit override are not inherited. Its `allowExcessArgs` metadata only enables excess arguments when truthy; setting it to `false` does not disable the Commander default. Explicitly call `allowExcessArguments(false)` in `ScanCommand.setCommand()`, following the root's existing pattern. Unknown options remain rejected by default.
- Child help/errors need their own throwing `exitOverride`, otherwise Commander can terminate before Nest cleanup. Introduce one command-layer parser-exit helper shared by the factory `errorHandler` and scan's `setCommand()`. It wraps the actual parser callback error in a project-owned `ParserExitSignal` and throws. Only that wrapper is recognized by bootstrap's `serviceErrorHandler`; ordinary errors merely carrying `commander.helpDisplayed` or `exitCode: 0` still fail. This replaces bootstrap's root-only captured-object mechanism while preserving its safety intent. Do not classify arbitrary errors by their `code` property.
- Keep the parser wrapper/helper independent of command providers to avoid an import cycle. It carries only the normalized parser exit decision and optional internal cause; it never prints raw errors. Help/version select `0`, parser failures select `2`. Bootstrap applies that decision after factory shutdown, and unexpected execution/cleanup failures still override it with safe stderr and `2`.
- Use a temporary result containing only `gatePassed: boolean`, returned by `ScanService.scan({ ci: boolean })`. The concrete shell returns `{ gatePassed: false }` in both modes; it cannot claim release readiness before checks exist. It emits no fabricated rows, score, or report. Thus the development shell exits `0` locally and `1` with `--ci`, with empty stdout/stderr on normal execution. README must state that this stage performs no checks and its CI result is a placeholder. Full domain contracts remain feature 04; retain structural compatibility with the future `ScanReport` and remove the temporary result type then.
- Keep the exit selector in `commands/`: local completion selects `EXIT_CODE.SUCCESS`; CI selects success only for `gatePassed: true`, otherwise `EXIT_CODE.GATE_FAILED`. Fatal failures propagate to bootstrap. Do not calculate scores or thresholds in the command.

**Implemented areas (paths marked new were introduced by this feature):**

| Path | Planned responsibility |
| --- | --- |
| `src/commands/scan.command.ts` (new) | Strict command metadata, boolean parsing, service delegation, completed-command exit assignment |
| `src/commands/scan-command.options.ts` (new) | Parsed option type with optional `ci` |
| `src/commands/select-exit-code.ts` (new) | Pure local/CI gate-to-exit mapping using existing constants |
| `src/commands/parser-exit.ts` (new) | Shared throwing parser boundary and recognizable signal |
| `src/scan/scan.module.ts` (new) | Register and export temporary service |
| `src/scan/scan.service.ts` (new) | Injectable shell implementing the asynchronous scan method |
| `src/scan/scan-shell-report.type.ts` (new, temporary) | Minimal gate result; superseded by feature 04's report contract |
| `src/commands/commands.module.ts` | Import `ScanModule` and register `ScanCommand` alongside root |
| `src/bootstrap.ts` | Use shared parser signal handling; preserve factory lifecycle and safe diagnostics |
| `test/unit/commands/` (new tests) | Delegation, awaiting completion, exit matrix, and provider injection |
| `test/integration/scan-command.integration.spec.ts` (new) | Compiled parser, help, exit, and cleanup behavior |
| `test/integration/bootstrap.integration.spec.ts`, `test/unit/bootstrap.spec.ts`, `test/helpers/` | Update help expectations and add test-only scan/lifecycle probes |
| `README.md`, relevant context files | Explain staged behavior, record implementation evidence, keep help/API documentation accurate |

**Ordered implementation:**

1. Add the temporary service/result and module. Keep the service free of project access, output, and exit decisions. Define typed command options and the pure exit selector using the existing `EXIT_CODE` constants.
2. Add the shared parser signal boundary and connect it to bootstrap. Preserve help/version behavior, fixed safe diagnostics, cleanup-error precedence, and rejection of lookalike success errors. Do not introduce another Nest context or a direct Commander dependency.
3. Register `ScanCommand`. In `setCommand()`, apply explicit argument rejection and the shared throwing exit override to the framework-owned command. Parse only boolean `--ci`; await one service call before assigning the selected `process.exitCode`.
4. Add focused unit/DI tests and compiled CLI coverage. Reuse tsc-compiled tests and native subprocess probes. Keep all injected gate outcomes, failures, lifecycle markers, and call observations under `test/`; add no production test switches.
5. Update root-help expectations to include `[command]` and the scan listing. Replace the old test that rejects `scan` with an actually unknown command. Preserve bare root help and disabled implicit `help` command. Capture actual framework help formatting; align the illustrative output documentation with it instead of introducing a custom renderer solely to reorder sections.
6. Run verification below. Update README, architecture/library notes where behavior changed, and the tracker with actual outcomes. Confirm the scanner registry still accurately marks all four scanners and the registry provider as not started. Mark feature 03 complete only after these gates pass; feature 04 is next.

**Acceptance and verification:**

| Scenario | Observable result |
| --- | --- |
| Root help, `-h`, and bare invocation | Root help lists `scan [options]` and its exact description; no service call; stdout, empty stderr, exit `0` |
| `scan --help` and `scan -h` | Scan usage plus documented `--ci` and built-in help; no scan execution; exit `0`; asynchronous cleanup completes |
| `scan` | Exactly one service call with `{ ci: false }`; normal shell output empty; exit `0` after service completion |
| `scan --ci` | Exactly one service call with `{ ci: true }`; shell returns failed gate, output empty, exit `1` preserved through shutdown |
| `scan` with ambient `CI=true` | Still delegates `{ ci: false }`; no implicit mode selection |
| Local/CI with injected gate true/false | Full four-case exit matrix: local `0` for either result; CI `0`/`1`; no assignment while the service promise is pending |
| `scan --unknown`, `scan ./project`, `scan -- ./project` | Stable usage stderr, empty stdout, exit `2`, no service call, cleanup completed |
| `scan --ci=false`, `scan --ci true`, `scan --no-ci` | Reject value-bearing/negated forms with usage exit `2`; no scan execution |
| Root `--ci`, unknown command, positional root path | Existing strict usage behavior retained |
| Injected scan rejection, including a help-signal lookalike | Safe fatal stderr, exit `2`, initialized application cleanup attempted; no secret marker, stack, or raw error |
| Cleanup rejection after scan or child help | Fatal exit `2` overrides the command/parser result |
| Normal shell and help in an unrelated temporary directory | No project discovery, Git/npm command, network listener, or target-file mutation; no Nest logs, ANSI, or spinner artifacts |
| Existing version, metadata, and bootstrap regression cases | Continue passing, with only intentional root-help changes |

- Assert stdout, stderr, service invocation, and exit codes independently. Observe forwarding through a test-only production-module preload; do not infer it only from calling `run()` directly.
- Use a Nest testing module with a service override to prove real command constructor injection, and a deferred service promise to prove exit selection waits for completion. Restore `process.exitCode` and mocks after each unit test.
- Use compiled subprocess lifecycle probes for successful scan, child help, parser failure, service rejection, and cleanup rejection. Preserve the existing no-network and secret-marker checks.
- Run `npm test` with `NO_COLOR=1`; its pretest already runs the required production build and test compilation. No lint script currently exists.
- Manually run compiled root help, scan help, local shell, CI shell, and an invalid scan option, checking streams and exit codes. Run `git diff --check`.
- Record the actual Node/OS used. Minimum-Node/other-OS execution and installed npm launcher/package checks remain unverified until exercised; packaging remains feature 17.

**Completion:** The planned conservative temporary gate result and silent shell are implemented, explicitly limited to this development stage. `npm test` with `NO_COLOR=1` passed production/test compilation and 70 tests: the existing 38 plus seven command unit/DI cases and 25 compiled scan cases. Manual root/scan help, version, local/CI shell, and invalid scan option checks produced the expected streams and exits. Scoped review found no actionable findings. All four scanners and the registry remain not started; no real scan/report or installed-package verification is claimed. No unresolved feature 03 decision remains.

---

## Phase 2 — Core Contracts and Infrastructure

### 04 Domain Contracts and Constants

Define all project-owned shapes before scanner implementation.

**Implementation:**

- `ScanContext`
- `Scanner` contract
- `ScanStatus`, `ScanResult`, `ReadinessStatus`, and `ScanReport`
- Package JSON subset type
- Exit-code constants
- Scanner weight and threshold constants
- Canonical scanner order/IDs

**Acceptance:**

- All scanner IDs are a closed union
- Result objects cannot omit duration or weight
- Weights total 100
- Thresholds exist in one module
- No terminal-library types appear in domain contracts

**Tests:**

- Constant invariant test for total weight
- Typecheck covers contract use

---

### 05 Infrastructure Adapters

Create process, read-only filesystem, and timing adapters used by scanners. The process adapter executes repository-owned build/test scripts, which may have side effects.

**Implementation:**

- `ProcessRunner` wrapping Execa
- `FileSystem` wrapping `node:fs/promises`
- `Clock` wrapping monotonic time
- `InfrastructureModule` exporting all three
- Project error type for process-start failures

**Acceptance:**

- Non-zero command exit returns a result rather than throwing
- Spawn failure is distinguishable
- Timeout is distinguishable
- Filesystem `exists()` returns false only for missing paths
- No write method exists on `FileSystem`

**Tests:**

- Process success
- Process non-zero
- Process timeout
- Executable missing
- File exists/missing/read behavior
- Clock duration behavior

---

### 06 Project Discovery and Scan Context

Build the entry validation for the current working directory.

**Implementation:**

- Resolve `process.cwd()` once in command execution
- Read and parse `package.json`
- Validate that parsed root is an object
- Determine project name with directory-basename fallback
- Create immutable `ScanContext`
- Add human-readable fatal errors

**Acceptance:**

- Valid Node project creates a context
- Missing `package.json` exits `2`
- Invalid JSON exits `2`
- Missing package name uses directory basename
- No parent-directory search occurs

**Tests:**

- Valid package
- Missing file
- Invalid JSON
- JSON primitive rather than object
- Missing/blank name fallback

---

## Phase 3 — Scanners

### 07 Git Scanner

Implement the first complete scanner and prove the scanner architecture.

**Implementation:**

- Register `GitScanner` as a Nest provider
- Run the three approved read-only Git commands
- Detect work-tree membership
- Determine named branch or detached HEAD
- Count porcelain entries without returning paths
- Return normalized result and duration

**Acceptance:**

- Clean repository passes
- Dirty repository fails with count
- Non-Git directory fails
- Missing Git executable returns error
- No changed path appears in result

**Tests:**

- Every Git case listed in `scanner-registry.md`
- Small integration test with temporary Git repositories

**Documentation:**

- Mark Git scanner complete in `scanner-registry.md`

---

### 08 Build Scanner

Implement build-script verification and execution.

**Implementation:**

- Detect non-empty `scripts.build`
- Run `npm run build`
- Use scan `cwd`
- Apply 120-second timeout
- Map exit, timeout, and spawn outcomes

**Acceptance:**

- Passing build passes
- Missing/blank script fails without spawning npm
- Non-zero build fails
- Timeout fails with canonical message
- Spawn failure returns error

**Tests:**

- Every Build case listed in `scanner-registry.md`

**Documentation:**

- Mark Build scanner complete in `scanner-registry.md`

---

### 09 Test Scanner

Implement test-script verification and execution.

**Implementation:**

- Detect non-empty `scripts.test`
- Run `npm test`
- Preserve environment and add `CI=true`
- Apply 120-second timeout
- Do not add framework-specific CLI flags
- Map exit, timeout, and spawn outcomes

**Acceptance:**

- Passing tests pass
- Missing/blank script fails without spawning npm
- Non-zero tests fail
- Timeout fails with canonical message
- Spawn failure returns error
- Parent environment remains unchanged

**Tests:**

- Every Test case listed in `scanner-registry.md`

**Documentation:**

- Mark Test scanner complete in `scanner-registry.md`

---

### 10 Environment Scanner

Implement presence-only environment contract validation.

**Implementation:**

- Skip if `.env.example` is absent
- Parse example, `.env`, and `.env.local` with `dotenv.parse`
- Treat a required name as present when any approved source supplies a non-empty value
- Treat empty/whitespace values as missing
- Normalize and alphabetically sort missing names
- Ensure values never enter result objects

**Acceptance:**

- Missing example skips
- Complete environment passes
- Missing or empty variable fails
- Results contain names only
- Process environment is not mutated

**Tests:**

- Every Environment case listed in `scanner-registry.md`
- Explicit negative assertion that known secret fixture values never appear

**Documentation:**

- Mark Environment scanner complete in `scanner-registry.md`

---

### 11 Scanner Registry

Compose all scanners under one ordered injection token.

**Implementation:**

- Create `SCANNERS` token
- Register all four concrete providers
- Add explicit ordered factory provider
- Export registry to `ScanModule`

**Acceptance:**

- Exactly four scanners are injected
- IDs are unique
- Order is Git, Build, Tests, Environment
- Weights total 100

**Tests:**

- Registry invariant tests from `scanner-registry.md`

---

## Phase 4 — Orchestration and Reporting

### 12 Scan Orchestration

Run the complete scanner pipeline safely and sequentially.

**Implementation:**

- Build context through project discovery
- Execute scanners in registry order
- Measure whole-scan duration
- Catch unexpected failure per scanner
- Continue after failed/error results
- Pass results to scoring
- Pass final report to reporter

**Acceptance:**

- Scanner calls are sequential
- Later scanners run after a failure or error
- One result exists for every registry item
- Reporter receives exactly one final report

**Tests:**

- Order test
- Continue-after-failure test
- Continue-after-throw test
- Final report assembly test

---

### 13 Scoring Service

Implement equal-weight readiness scoring.

**Implementation:**

- Exclude skipped results from denominator
- Include error results as applicable and not passed
- Round final percentage once
- Map score to status
- Map status to gate decision

**Acceptance:**

- Four passes → 100, READY, passed gate
- Three of four pass → 75, REVIEW, failed gate
- Two of four pass → 50, NOT READY, failed gate
- Three passes plus one skip → 100, READY, passed gate
- Boundaries 69, 70, 89, and 90 map correctly

**Tests:**

- Table-driven score cases
- Threshold boundary cases
- Error and skip cases
- Zero-denominator defensive case

---

### 14 Terminal Reporter

Implement the complete plain and styled report.

**Implementation:**

- Add writer abstraction for stdout/stderr
- Add color and TTY capability abstraction
- Render heading, metadata, ordered results, and summary
- Add safe detail limiting/truncation
- Apply semantic Chalk styling
- Add local Ora progress lifecycle
- Disable animation/color where required

**Acceptance:**

- Output matches `cli-output-rules.md`
- Symbols and labels match `cli-output-tokens.md`
- CI and non-TTY output contain no ANSI/spinner artifacts
- Environment values and command output never appear
- Long detail sets are safely summarized

**Tests:**

- Plain snapshots for ready, review, not-ready, skip, and error
- Detail truncation tests
- ANSI-enabled focused test
- CI/non-TTY/NO_COLOR tests
- stdout/stderr separation test

---

### 15 CI Exit Enforcement

Connect completed reports to public exit behavior.

**Implementation:**

- Local completed scan always selects `0`
- CI ready scan selects `0`
- CI review/not-ready selects `1`
- Fatal discovery/bootstrap selects `2`
- Set exit code only after report rendering completes

**Acceptance:**

- Exit matrix matches architecture
- Scanner services cannot set exits
- Report is present before process terminates

**Tests:**

- Command unit exit matrix
- Compiled CLI process tests for `0`, `1`, and `2`

---

## Phase 5 — Verification and Packaging

### 16 Integration Fixture Suite

Exercise the compiled CLI against representative projects.

**Fixtures:**

- Ready project
- Dirty Git project
- Failing build project
- Failing test project
- Missing environment project
- Project without `.env.example`
- Invalid/non-Node directory

**Acceptance:**

- Each fixture produces expected rows, score, status, gate, and exit code
- Test runs are isolated and repeatable
- No committed fixture is mutated
- Mutation checks on temporary fixture copies account for expected build/test script output and verify that Shipcheck-owned operations make no changes
- No network is used

---

### 17 Executable and Package Smoke Test

Verify Shipcheck behaves like an installable developer tool.

**Implementation:**

- Build cleanly from source
- Run `npm pack --dry-run`
- Confirm package contains compiled runtime, README, and license only
- Test package install/link in a temporary directory
- Run help, version, local scan, and CI scan through the executable name

**Acceptance:**

- `shipcheck` resolves from npm `bin`
- Help and version work outside the source repository
- Scan uses the target project's `cwd`
- Package has no missing runtime dependency
- No public npm publication occurs

---

### 18 Documentation and v0.1 Release Candidate

Finish documentation only after behavior is verified.

**Implementation:**

- Complete README installation and local-link instructions
- Document trust warning: build/test scripts execute repository-owned code and may generate files or perform other side effects; scanning is not a sandbox
- Document four scanners and score policy
- Document local versus CI exit behavior
- Include exact example output
- State v0.1 limitations
- Final context consistency review

**Acceptance:**

- Every README command works
- README output matches reporter snapshots
- No out-of-scope feature is promised
- Build, tests, integration suite, and package smoke test pass
- Progress tracker has no unchecked v0.1 items

---

## Feature Count

| Phase                                  | Features |
| -------------------------------------- | -------: |
| Phase 1 — Foundation                   |        3 |
| Phase 2 — Contracts and Infrastructure |        3 |
| Phase 3 — Scanners                     |        5 |
| Phase 4 — Orchestration and Reporting  |        4 |
| Phase 5 — Verification and Packaging   |        3 |
| **Total**                              |   **18** |

---

## v0.1 Completion Gate

Do not call the version complete until all are true:

- All 18 features are checked in `progress-tracker.md`
- Four-scanner registry is unchanged
- TypeScript build passes
- Unit tests pass
- Integration fixture suite passes
- Package smoke test passes
- Help, version, scan, and scan `--ci` work through the compiled executable
- No secret values appear in output or snapshots
- Shipcheck-owned operations do not modify scanned projects; mutation checks account for expected repository-owned build/test script side effects and leave committed fixture sources unchanged
- Out-of-scope features remain absent
