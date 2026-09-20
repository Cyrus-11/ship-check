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

**Implementation:**

- Add `ScanCommand`
- Add `--ci` boolean option
- Add typed `ScanCommandOptions`
- Add a temporary `ScanService` contract returning a minimal report
- Add central exit-code selector
- Keep command free of business logic

**Acceptance:**

- Root `shipcheck --help` lists `scan [options]` with description `Run release-readiness checks`, completing the help contract from `cli-output-rules.md`
- `shipcheck scan` invokes `ScanService` with `ci: false`
- `shipcheck scan --ci` invokes it with `ci: true`
- Unknown flags are rejected by the command framework
- No path argument is accepted

**Tests:**

- Root help lists the registered scan command, and scan help exposes `--ci`
- Local option parsing
- CI option parsing
- Unknown option behavior
- Exit-code selector table

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
