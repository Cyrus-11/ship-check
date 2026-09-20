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

**Implementation:**

- Add `CommandsModule`
- Configure `CommandFactory.run()` with `cliName: "shipcheck"`
- Disable plugin discovery
- Supply package version to the command factory
- Add bootstrap error handling and exit code `2`
- Confirm default Nest logs do not pollute output

**Acceptance:**

- `shipcheck --help` shows the product description and scan command
- `shipcheck --version` prints `0.1.0`
- Process terminates cleanly after help/version
- No port opens and no HTTP adapter loads

**Tests:**

- Command-factory integration test for help
- Version output test
- Bootstrap error-handler test through an isolated seam where practical

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

- `shipcheck scan` invokes `ScanService` with `ci: false`
- `shipcheck scan --ci` invokes it with `ci: true`
- Unknown flags are rejected by the command framework
- No path argument is accepted

**Tests:**

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
