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

**Status:** Implemented and verified on 2026-09-21. Production/test builds, compiler-only contract checks, and all 75 tests across seven files passed on Windows / Node 24.16.0. Feature 05 is next. The saved `memory.md` update predates this feature and is preserved.

**Outcome and scope:**

Establish the shared types and policy constants that subsequent scanners, orchestration, scoring, and reporting will consume. Keep current help, version, parsing, cleanup, and shell exits intact. This feature adds no project discovery, filesystem/process adapter, scanner implementation or registration, scoring calculation, report rendering, dependency, or CLI option. Process adapter request/result types remain feature 05; scorer-specific return shapes remain feature 13.

**Contract decisions:**

| Contract | Planned shape and ownership |
| --- | --- |
| `ScannerId` | Derived from the canonical ordered tuple: `git`, `build`, `test`, `env`; no second handwritten ID union |
| `ScanStatus` | `passed`, `failed`, `skipped`, `error` |
| `ReadinessStatus` | `READY`, `REVIEW`, `NOT_READY`; display label `NOT READY` remains reporter-owned |
| `PackageJson` | Readonly optional `name: string` and readonly optional `scripts` containing optional string `build` and `test` fields; only the subset consumed by v0.1 |
| `ScanContext` | Readonly `cwd`, `projectName`, `packageJsonPath`, `packageJson: PackageJson`, and `ci`; all required |
| `ScanResult` | Required `id: ScannerId`, `name`, `status: ScanStatus`, `summary`, `details: string[]`, `durationMs: number`, `weight: number`, matching architecture |
| `ScanReport` | Required `projectName`, `cwd`, `results: ScanResult[]`, `score: number`, `status: ReadinessStatus`, `gatePassed: boolean`, `durationMs: number`, matching architecture |
| `Scanner` | Behavioral interface with readonly `id`, `name`, `weight`, and `run(context: ScanContext): Promise<ScanResult>` |

- Use `type` for data and unions, `interface` for the scanner behavior, and type-only imports with `.js` paths. Give each primary type its own file. No Nest, Commander, Execa, Chalk, or Ora types/decorators enter these contracts.
- `PackageJson` describes a validated in-memory projection, not arbitrary parsed JSON or the entire npm manifest. Feature 06 must narrow unknown input and select supported fields rather than assert parsed data as `PackageJson`. Unsupported fields are ignored; non-string name/script fields are omitted from the projection, preserving later name fallback and missing-script behavior. Do not implement parsing or add new fatal metadata rules in feature 04. Keep blank strings representable so existing discovery/scanner rules decide their meaning.
- Make context and its package subset readonly at the TypeScript boundary, consistent with feature 06's immutable-context requirement. This is compile-time protection, not a runtime deep-freeze guarantee. Keep result/report arrays as specified in the architecture; introduce no generic deep-readonly utility or branded number types.
- Weights, durations, and scores remain numbers in the contracts. Runtime validation, score/status consistency, four-result completeness, and gate calculation belong to their later providers; defining types is not proof those runtime invariants hold.

**Constants and dependency direction:**

- Add `SCAN_ORDER` as a readonly literal tuple in `common/constants/scan-order.ts`, frozen at runtime. Derive `ScannerId = (typeof SCAN_ORDER)[number]` in its type file. This is policy data, not the feature 11 injection registry; no `SCANNERS` token or dynamic discovery is added.
- Add `SCANNER_WEIGHTS` in `common/constants/scoring.ts`: exactly the four IDs, each 25. Use `as const satisfies Record<ScannerId, number>` so missing/extra keys are compile errors while preserving literals; freeze the flat object.
- In the same scoring file, define frozen `READINESS_THRESHOLDS` with `READY: 90` and `REVIEW: 70`. No duplicate threshold literals in consumers; `NOT_READY` is the eventual below-review fallback, not another threshold.
- Reuse `common/constants/exit-codes.ts` unchanged (`0`, `1`, `2`); feature 03 already centralized it. No additional exit codes or readiness mapping function.
- `scan-order.ts` depends on no types; the ID type refers to that tuple; scoring imports only the ID type. Other domain types use type-only imports, avoiding a runtime import cycle.

**Transition from the feature 03 shell:**

Define the complete `ScanReport`, then replace `ScanShellReport` imports in the service, exit selector, command unit tests, and scan probe with `Pick<ScanReport, "gatePassed">`. Delete the temporary type file. The selector permanently needs only this projection; the service temporarily returns the projection until real orchestration can construct a complete report. A future full `ScanReport` is structurally compatible with the selector.

The service still returns `{ gatePassed: false }`, prints nothing, and performs no checks: local/CI exits remain `0`/`1`. Do not use `Partial<ScanReport>`, an unsafe assertion, optional full-report fields, or invented names/paths/scores/results to make the shell look like a completed scan. Update architecture/library notes to state that the full type exists while report assembly remains future work.

**Affected areas (new paths are proposed):**

| Path | Change |
| --- | --- |
| `src/common/types/scanner-id.type.ts` | New derived ID union |
| `src/common/types/scan-status.type.ts`, `readiness-status.type.ts` | New status unions |
| `src/common/types/package-json.type.ts`, `scan-context.type.ts` | New package subset and readonly context |
| `src/common/types/scan-result.type.ts`, `scan-report.type.ts` | New complete result/report shapes |
| `src/common/contracts/scanner.contract.ts` | New scanner interface |
| `src/common/constants/scan-order.ts`, `scoring.ts` | New canonical policy constants |
| `src/common/constants/exit-codes.ts` | Reuse; no implementation change planned |
| `src/scan/scan-shell-report.type.ts` | Remove temporary duplicate shape |
| `src/scan/scan.service.ts`, `src/commands/select-exit-code.ts` | Use report gate projection |
| `test/unit/commands/scan.command.spec.ts`, `test/helpers/scan-probe.ts` | Migrate existing test types; retain behavioral assertions |
| `test/unit/common/constants.spec.ts` | New policy invariant tests |
| `test/typechecks/domain-contracts.ts` | New compiler-checked positive/negative contract cases, included by existing test tsconfig and never executed |
| `context/architecture.md`, `library-docs.md`, `build-plan.md`, `progress-tracker.md` | Record contract boundaries, staged service return, and actual verification evidence |

**Ordered implementation:**

1. Add canonical order, derived ID type, weights, and thresholds. Reuse exit constants. Keep IDs and policy values in their designated modules.
2. Add the remaining domain types and Scanner interface, matching the field table above. Document the validated package subset and compile-time readonly guarantees in architecture.
3. Migrate shell consumers/tests to the report gate projection and remove the old source file. Remove only the obsolete generated `scan-shell-report.type` artifacts under `dist/scan/` and `.test-dist/src/scan/` after verifying their paths are inside the workspace: tsc does not delete outputs for removed sources. Do not add an unrelated build-system overhaul.
4. Add policy invariant tests and compiler-checked contract examples. Negative examples use narrowly placed, explained `@ts-expect-error` directives in an uncalled test-only function; no `any`, suppression of real compiler errors, production fixtures, or new test tooling.
5. Run the checks below and inspect emitted output. Update documentation/tracker with observed evidence, confirm scanner-registry statuses remain accurate, and mark feature 04 complete only after passing. Feature 05 follows.

**Acceptance and verification:**

| Criterion | Verification |
| --- | --- |
| Exactly four unique IDs in Git/Build/Tests/Environment order | Runtime invariant test asserts exact tuple and uniqueness |
| Every scanner has weight 25 and configured total is 100 | Assert exact key coverage, each weight, and sum over canonical IDs |
| Thresholds and exits match policy | Assert READY 90, REVIEW 70, and existing exit values 0/1/2; no scoring algorithm is tested or added yet |
| Constants cannot be changed at runtime | Assert the tuple and flat policy maps are frozen |
| Closed IDs/statuses and complete required fields | Compiler accepts valid context/scanner/result/report examples; rejects an unsupported ID/status and omitted result duration/weight or report field |
| Scanner contract is asynchronous with immutable identity/context | Compiler rejects incompatible run return, identity reassignment, and context/package-subset mutation |
| Package subset is safely typed | Compiler accepts absent name/scripts and valid strings; rejects non-string name/build/test values; parsing itself is deferred |
| Complete reports satisfy the command's narrow dependency | Compiler accepts a full report passed to the exit selector; existing four-case exit tests remain intact |
| Feature 03 behavior is preserved | Existing compiled CLI suite retains help/version, strict parsing, forwarding, local/CI exits, safe failures, and cleanup assertions |
| Removed temporary contract is gone | Search source/tests for `ScanShellReport` and obsolete imports; inspect generated output for stale deleted-file artifacts |
| Domain has no framework/presentation dependency | Review imports and emitted declarations; no terminal symbols, status display labels, or library-specific types |

Run `npm test` with `NO_COLOR=1`; pretest covers production build and test compilation, including the negative type cases. Reuse the existing 70 behavior tests and add only contract/policy coverage; no duplicate subprocess suite or broad new platform tests are needed. Run `git diff --check`. There is no configured lint script. Record the actual platform used; Node minimum, other operating systems, installed npm launchers, and packaging remain separate verification gaps.

**Compatibility evidence:** Manifest, lockfile, and installed TypeScript agree on 5.9.3. Inspected `lib.es5.d.ts` definitions for `Pick`, `Record`, `Readonly`, and `Object.freeze`, plus official [utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html), [typeof types](https://www.typescriptlang.org/docs/handbook/2/typeof-types.html), and [satisfies](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html) documentation. These features predate the installed compiler; no dependency/runtime upgrade or new relevant skill is needed.

**Completion:** Implemented the contracts, frozen scanner/scoring constants, and gate-only report projection as planned. Reused exit constants unchanged. Removed `ScanShellReport` and its six obsolete generated artifacts; no old references remain in source, tests, or generated output. `npm test` with `NO_COLOR=1` passed production/test compilation, all expected compiler rejections, and 75 tests across seven files (the existing 70 plus five policy checks). Inspected emitted declarations for required fields, readonly identity/context, derived IDs, and framework-independent types. The existing compiled CLI suite verified unchanged shell/help/exit/cleanup behavior; no separate manual smoke was repeated because the public behavior did not change. `git diff --check` passed. Scoped review found no actionable findings, and scanner-registry entries remain accurately not started. No unresolved feature 04 decisions remain; no commit or push is part of this implementation.

---

### 05 Infrastructure Adapters

Create process, read-only filesystem, and timing adapters used by scanners. The process adapter executes repository-owned build/test scripts, which may have side effects.

**Status:** Implemented and verified on 2026-09-21 following the approved plan. Production/test compilation and all 139 tests across 11 files passed on Windows / Node 24.16.0. Feature 06 is next. Features 01–04 are committed and pushed at `9a86f0b`; Feature 05 is not committed or pushed. Memory's uncommitted Feature 04 snapshot is historical.

**Outcome and scope:**

Provide injectable ProcessRunner, FileSystem, and Clock providers through InfrastructureModule. Preserve the existing shell and public command surface. No discovery, real scanners, registry, scoring, reporting, configuration, CLI options, or new dependencies are included. Do not connect the adapters to ScanService until a later feature actually uses them. Repository scripts may have side effects; these adapters are not a sandbox.

**Installed API findings:**

- Manifest, lockfile, and installed package agree on Execa 10.0.1 (Node >=22); the project remains Node >=22.12, Nest 11.2.5, TypeScript 5.9.3. No relevant Execa-specific installed skill or documentation MCP is available. Inspected installed exported options/results and implementation alongside versioned official documentation.
- `reject: false` returns Execa error-shaped results for spawn failures, timeouts, signals, and output limits as well as ordinary non-zero exits. Some invalid options throw before a subprocess exists. A catch-only spawn-error mapping and unconditional `exitCode ?? 1` are insufficient; replace the illustrative mapping in library docs during implementation.
- `exitCode` can be absent on timeout/spawn/signal termination. `isMaxBuffer` can be true even when exitCode is 0. A native probe observed normal non-zero exit 7, timeout with no exitCode, and a 20-byte capped Unicode result with exitCode 0 and isMaxBuffer true. Inspect failure flags before treating exitCode 0 as success.
- Execa's text-mode maxBuffer counts characters; `encoding: "buffer"` counts bytes. Capture binary output with a 1,000,000-byte cap per stream, then decode UTF-8 inside the adapter to honor the project's actual 1 MB limit. Do not retain both result and raw Execa object on successful return.
- On Windows Execa resolves npm to npm.cmd and internally constructs a cmd.exe invocation even with shell:false. A read-only `npm --version` probe succeeded. A missing executable probe instead resolved to a failed cmd.exe invocation with exitCode 1 and no ENOENT code; blindly returning it would misclassify unavailable Git/npm as a repository failure.
- Execa 10 provides `killDescendants: true`; it targets a process group on POSIX and uses taskkill on Windows. Cleanup is best-effort and cannot guarantee termination of escaped/detached descendants. `windowsHide: true` avoids new console windows; no custom visible helper process is needed.

Sources: official [Windows behavior](https://github.com/sindresorhus/execa/blob/v10.0.1/docs/windows.md), [errors](https://github.com/sindresorhus/execa/blob/v10.0.1/docs/errors.md), [termination](https://github.com/sindresorhus/execa/blob/v10.0.1/docs/termination.md), and Node 22.12 [filesystem](https://nodejs.org/download/release/v22.12.0/docs/api/fs.html) / [performance](https://nodejs.org/download/release/v22.12.0/docs/api/perf_hooks.html) documentation. Installed source governs version-specific details.

**Approved Windows decision:**

The original architecture said “Never execute through a shell.” The user authorized this clarification: Shipcheck always uses `execa(file, args, { shell: false, ... })`, never composes a shell command string, and never explicitly launches a shell; Execa's internal Windows launcher for a resolved npm.cmd is permitted. This retains npm's installed launcher behavior and avoids a custom version-manager/npm bootstrap implementation. It does not permit generic shell commands, project-script interpolation, or shell:true.

Architecture and code standards now record the approved exception. Windows supports native .exe/.com and resolved npm.cmd; arbitrary shebang/batch launchers and App Execution Aliases that deny metadata access fail safely. No custom npm installation/version-manager resolution is introduced.

**Project-owned contracts:**

- `ProcessRequest`: keep the documented fields `file: string`, `args: string[]`, `cwd: string`, `env?: NodeJS.ProcessEnv`, `timeoutMs: number`. Executable and arguments stay separate; env contains overrides, not a replacement environment. The adapter must not mutate the request, its args/env, or process.env.
- `ProcessResult`: keep `exitCode: number`, `stdout: string`, `stderr: string`, `timedOut: boolean`. For a timeout return `exitCode: 1` and timedOut:true; that 1 is an adapter sentinel, not a claim about an actual child exit. Other returned exit codes are actual numeric process exits. Operational failures throw project-owned errors and never become this sentinel result.
- `ProcessStartError`: fixed safe message, optional internal cause, no raw command/arguments/output in its public message. Represents executable lookup/start failure, including missing command, missing cwd, access denial, or a failed launcher/interpreter start.
- `ProcessExecutionError`: fixed safe message and a readonly reason (`invalid_request`, `output_limit`, `signal`, or `adapter`) plus optional internal cause. Keeps non-start operational problems distinct from a repository's normal non-zero exit. Execa-specific types remain inside ProcessRunner.
- Raw captured output is internal adapter data only. Later scanners may inspect it for their documented checks but must never copy it into reports or diagnostics. Error causes may be retained internally and must never be serialized or logged to users.

**ProcessRunner design:**

1. Validate a non-empty executable, string arguments, absolute cwd, and finite positive timeout before launch. No arbitrary default cwd or disabled/infinite timeout. Reject invalid requests with a safe project error. Callers will choose 10,000 ms for Git and 120,000 ms for build/test; put those execution limits and the output cap/termination grace in one infrastructure constants file rather than duplicating scanner literals.
2. Snapshot the inherited environment plus request overrides without mutating either. On Windows normalize equivalent environment keys case-insensitively so an override such as PATH does not coexist ambiguously with Path. Caller values win; undefined overrides remove the matching key. Pass the completed snapshot with extendEnv:false. Preserve unrelated inherited variables. ProcessRunner never adds CI itself; the future TestScanner supplies `CI: "true"`.
3. Before Windows launch, use read-only executable lookup behind FileSystem so unavailable commands fail before Execa's cmd fallback. Resolve explicit paths from request.cwd, and bare names via the effective PATH/PATHEXT, honoring case-insensitive keys, quoted PATH entries, standard PATHEXT fallback, and NoDefaultCurrentDirectoryInExePath. Do not search parent projects or add node_modules/.bin. Return a validated absolute file; missing candidates produce ProcessStartError, and genuine access errors are not treated as absence. Do not infer missing commands by parsing localized stderr. Pass the resolved path to Execa. Resolution is not a sandbox and cannot eliminate filesystem races; do not promise that.
4. Use shell:false, preferLocal:false, stdin:"ignore", stdout/stderr:"pipe", encoding:"buffer", buffer:true, stripFinalNewline:false, maxBuffer:1_000_000, verbose:"none", reject:false, explicit cwd/timeout, windowsHide:true, cleanup:true, killDescendants:true, and a finite forceKillAfterDelay (5,000 ms). Do not pipe output to the terminal or enable IPC. Stdin must not leave unattended scripts waiting for user input.
5. Classify in this order: invalid request/start errors; output-limit or other identifiable I/O failure; timeout; unexpected cancellation/signal or other adapter failure; ordinary numeric exit. An output limit is an operational error even if exitCode is 0. A timeout result always has timedOut:true. Unexpected rejection becomes a safe ProcessExecutionError unless it is positively identifiable as a start failure. A failed Execa result with no numeric exit and no recognized timeout must never silently become exit 1.
6. Decode captured bytes to UTF-8 only for normal/timeout ProcessResult returns. Await process termination/stream settlement before returning. Timeout/output-limit handling uses Execa's descendant cleanup, with a controlled tree test rather than assumptions about Windows or npm. Never add process.exit or terminal printing to these providers.

The one-megabyte policy limits captured bytes, not total subprocess memory or every temporary allocation inside Execa. Cleanup can extend elapsed time beyond timeoutMs by the configured grace and OS scheduling; do not advertise a hard wall-clock deadline or comprehensive containment.

**FileSystem and Clock design:**

- FileSystem is the only production provider importing node:fs/promises. `readText(absolutePath): Promise<string>` uses UTF-8 and propagates read failures. It does not parse JSON/dotenv or write anything.
- `exists(absolutePath): Promise<boolean>` uses filesystem access and returns false only for ENOENT. EACCES, EPERM, ENOTDIR, and unexpected failures propagate. Existence is not a promise of later readability, a regular file, or race-free access; consumers still handle read errors.
- A narrowly scoped `resolveWindowsExecutable(file, cwd, env): Promise<string | undefined>` method performs the Windows lookup needed by ProcessRunner. Only the resolver reads executable metadata outside the target project, consistent with the executable-resolution exception in architecture. Keep candidate construction deterministic and filesystem checks asynchronous. Check regular files, handle Windows case/extension matching, and document unsupported launcher layouts rather than treating arbitrary filesystem errors as absence. No direct use of the unapproved transitive which-command package.
- FileSystem takes absolute project paths; it never resolves process.cwd, searches parent package.json files, or enforces a fictitious filesystem sandbox. Symlink/permission behavior remains that of Node and is not described as containment.
- `Clock.now(): number` delegates to node:perf_hooks performance.now for monotonic milliseconds. Future callers subtract start/end values and leave rounding to reporting. No wall-clock timestamps, timers, delays, or Date.now fallback.
- InfrastructureModule registers and exports these three singleton providers, with ProcessRunner injecting FileSystem for Windows lookup. Keep module imports explicit; no global module, second runtime Nest context, or new command registration.

**Affected areas (new paths proposed):**

| Path | Responsibility |
| --- | --- |
| `src/common/types/process-request.type.ts`, `process-result.type.ts` | Library-independent process shapes |
| `src/infrastructure/process-runner.service.ts` | Execa invocation, environment snapshot, result/error normalization |
| `src/infrastructure/file-system.service.ts` | Read-only files and Windows executable lookup |
| `src/infrastructure/clock.service.ts` | Monotonic time seam |
| `src/infrastructure/infrastructure.module.ts` | Provider composition and exports |
| `src/infrastructure/process-start.error.ts`, `process-execution.error.ts` | Safe operational errors |
| `src/infrastructure/process-limits.ts` | Capture limit, termination grace, Git/build/test timeouts |
| `test/unit/infrastructure/` | Mapping, options/environment, filesystem and clock behavior; Nest DI |
| `test/integration/infrastructure.integration.spec.ts`, `test/helpers/` | Actual production adapter execution with temporary fixtures |
| `context/architecture.md`, `library-docs.md`, `code-standards.md`, `build-plan.md`, `progress-tracker.md`; AGENTS.md if launcher clarification is approved | Align process mapping/launcher rules and record evidence |

**Ordered implementation:**

1. Resolve the Windows launcher decision and reconcile the controlling rules if approved. Existing illustrative ProcessResult mapping must be replaced with the classified behavior above. Record any change before writing the dependent integration.
2. Add process contracts, limits, and safe errors. Implement FileSystem read/exists and Clock; cover their positive/error paths without running Git/npm. Add Windows lookup with deterministic environment/path fixtures and no production writes.
3. Implement ProcessRunner using installed Execa types, environment snapshot, bounded byte capture, explicit non-interactive options, and ordered failure classification. Avoid broad catch-and-relabel-as-start logic.
4. Export providers through InfrastructureModule. Verify constructor DI through tsc-compiled tests and the production build. Do not connect these providers to scan execution yet.
5. Run mocked boundary tests and controlled native adapter tests below. Fixture scripts are static files or constant Node arguments, never shell strings assembled from project data. Temporary npm scripts use cross-platform Node commands and no dependency install/network access.
6. Run the existing complete suite/build once the new focused tests pass; update tracker and library/architecture notes with actual evidence. Confirm all scanners and their registry remain not started. Feature 06 follows.

**Acceptance and verification:**

| Scenario | Expected evidence |
| --- | --- |
| Node child exits 0 or a chosen non-zero value | Exact exit/stdout/stderr mapping, timedOut:false; both streams captured, no parent output |
| Shell metacharacters and spaces in individual arguments | Child receives exact strings; no interpolation or side-effect marker; stdin reaches EOF |
| Missing executable, missing cwd, access/spawn error | ProcessStartError; never an ordinary failed result, including Windows missing-command fallback |
| Invalid request or rejected adapter call | Safe typed operational error; no raw args, environment values, output, or stack in public message |
| Timeout | timedOut:true and synthetic exitCode 1; no false success; controlled child/tree exits and fixture cleanup finishes |
| Max output on either stream, including multibyte Unicode | Byte cap enforced; output-limit error even with reported exitCode 0; no accidental terminal dump |
| Signal/cancellation or I/O failure without an ordinary exit | Operational error distinct from normal repository failure and start error |
| Environment overrides, including Windows casing | Existing variables preserved, requested CI string forwarded, parent/request unchanged, undefined removes a key |
| Windows lookup | PATH/PATHEXT order, explicit path, spaces, case variants, absent/quoted/empty entries, current-directory control, missing file, directory candidate, and genuine access failure |
| npm launcher in a temporary directory containing spaces | Production ProcessRunner runs static npm build/test scripts with expected output/exit; scripts record only test-owned markers; no network/install needed |
| File read/exists | UTF-8 content preserved, present/missing paths handled, non-ENOENT errors propagated, no write API or target mutation |
| Clock | Controlled monotonic readings produce expected deltas; minimal real monotonic check without timing-sensitive sleeps |
| Module boundary | Exported providers resolve through real constructor metadata; no new runtime app context, logs, listeners, or scan activity |
| Existing public CLI | All prior 75 tests remain passing; shell still prints no report and exits locally/CI as before |

Mock the library/filesystem/time boundaries for rare deterministic failures; use native Node subprocesses for real output, exits, timeout/cleanup, and argument preservation. Do not rely on user Git config, realistic secrets, global test frameworks, or real project scripts. Permission failures should be injected rather than depending on Windows ACLs or POSIX root behavior. Tree fixtures must track their own child IDs and have bounded test cleanup so a failing test does not leave processes behind; never terminate unrelated processes.

Run `npm test` with NO_COLOR=1 (pretest builds production and compiles tests), `git diff --check`, and inspect runtime imports to enforce adapter boundaries. No lint script is configured. Windows is available; POSIX signal/process-group and minimum-Node validation require those environments and must remain explicitly unverified if unavailable. Full installed Shipcheck packaging remains feature 17; native npm adapter smoke is required here.

**Planning evidence:** Native probes observed npm --version success, Windows missing-command exit 1 without ENOENT, non-zero exit 7, timeout without an exit code, and byte-limit failure with exitCode 0. They printed only metadata/lengths, not captured child output. The product test suite was not rerun during planning; implementation verification is recorded separately below. No Windows launcher decision remains open.

**Completion:** Implemented the three providers, explicit infrastructure module, process contracts/errors/limits, and the approved Windows npm launcher policy. Request timeouts are validated as integers in Node's supported 1–2,147,483,647 ms range. Added 52 unit/DI checks and 12 native integration checks; all 75 existing checks remain passing. Production build, test compilation, all 139 tests, and scoped review passed. Public CLI behavior, scanner status, and dependencies are unchanged; scanner registry was checked and remains accurate.

Windows process-tree verification requires normal process-management permissions: the sandbox denied taskkill, which was confirmed independently before the successful unsandboxed run. Test cleanup tracks its own script/child IDs and has an independent deadline. Full-suite parallel startup also exposed a two-second npm fixture timeout before script launch; matching the ten-second npm smoke allowance resolved that test timing failure. Recovery evidence is recorded in the tracker. POSIX native signals/process groups, minimum Node, and installed Shipcheck packaging remain unverified. Execa cleanup is best-effort; denied taskkill or escaped descendants can delay stream settlement beyond the configured timeout/grace.

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

**Architecture and decisions:**

- Add `EnvScanner` as a Nest singleton implementing `Scanner`. Its identity is `env` / `Environment`, with the existing `SCANNER_WEIGHTS.env` (25). Inject `FileSystem` and `Clock`; use `ScanContext.cwd` for all paths. No command is spawned.
- `.env.example` is the only contract. Its parsed keys define required names; example values, including placeholders, do not satisfy requirements. Duplicate declarations count once. An existing but empty/comment-only example defines zero required names and passes with `0 required variables are present` without reading optional sources.
- A required name is present if `process.env`, `.env.local`, or `.env` has at least one value whose trimmed length is greater than zero. Evaluate each source independently so an empty value in one source cannot mask a non-empty value in another. This is a presence check, not configuration precedence or value validation. Use exact parsed key names and alphabetically sort missing names.
- Use `FileSystem.exists()` and `readText()` on absolute paths. Missing `.env.example` skips immediately; absent optional files contribute no names. A filesystem failure other than an absent optional file returns one `error` result. If an optional file disappears between existence and read, treat `ENOENT` as absent; a vanished example is skipped. Do not include paths, error messages, or file contents in the public result.
- Parse file content with `dotenv.parse()`, never `config()`, and do not change `process.env`. The [dotenv parse documentation](https://github.com/motdotla/dotenv/blob/v18.0.3/README.md#parse) describes a string/Buffer-to-key/value parse. Implementation selected and locked `dotenv` 18.0.4 after checking npm metadata, its installed manifest, declarations, and README. Its Node >=12 requirement fits the project baseline; installed API findings and ESM verification are recorded in `library-docs.md`.
- Parsed values remain local to the scanner only until presence is evaluated. The result contains canonical summary text and missing names in `details`, never available names or any values. The reporter's five-name display cap remains Feature 14; do not truncate the scanner's `details` here.
- Use `Clock.now()` before and after evaluation and return exactly one complete `ScanResult` for passed, failed, skipped, or operational error. Filesystem/parser failures become a safe error result here; the Feature 12 `ScanService` safety boundary will also protect the overall pipeline.
- Provide/export `EnvScanner` from `ScannersModule`. Keep the ordered `SCANNERS` token/factory for Feature 11; scoring, reporting, and CLI exit behavior remain later features.

**Affected files:** `package.json`, `package-lock.json`, `src/scanners/env/env.scanner.ts`, `src/scanners/scanners.module.ts`, `test/unit/scanners/env/env.scanner.spec.ts`, `test/integration/env-scanner.integration.spec.ts`, `test/helpers/env-scanner-probe.ts` (native production provider verification), `context/library-docs.md` (installed-version findings), `context/scanner-registry.md`, and `context/progress-tracker.md` after verification.

**Build sequence:**

1. Confirm the current dependency tree and choose a compatible `dotenv` release. Add it as an exact runtime dependency, update the lockfile, inspect installed types/docs, and verify the supported import form under NodeNext.
2. Implement the scanner with a small file-reading helper that distinguishes absent files from read failures. Parse the example for required keys, then evaluate presence against optional files and `process.env`; construct only status, canonical summary, sorted missing names, duration, and weight.
3. Register the concrete provider in `ScannersModule` without creating `SCANNERS` yet.
4. Add focused unit tests with mocked `FileSystem`/`Clock`, then real temporary-file integration tests. Update the registry and tracker only after the required build and tests pass.

**Acceptance and verification:**

- Missing example returns `skipped` / `No .env.example found` without reading optional files. An unreadable example or optional file returns `error` / `Scanner could not complete`; an absent optional file is ignored.
- Every required name present across any approved sources returns `passed`, using `1 required variable is present` or `{count} required variables are present`. Missing or whitespace-only names return `failed`, using `Missing 1 required variable` or `Missing {count} required variables`, with unique alphabetically sorted names in `details`.
- Unit cases cover every Environment row in `scanner-registry.md`, including comments, quotes, duplicate names, source independence when one source is empty, duration, and Nest constructor injection. Assert that a sentinel secret value appears nowhere in the result and that `process.env` is unchanged.
- Temporary fixture tests exercise actual `.env.example`, `.env`, and `.env.local` reads for skipped, passed, failed, and unreadable-file paths where portable. Do not write environment fixture files into the committed project. Run `npm run build`, `npm test`, and `git diff --check`; record observed outcomes and platform limits in the tracker.

---

### 11 Scanner Registry

Compose all scanners under one ordered injection token.

**Status:** Implemented and verified on 2026-09-27. Baseline was `main` at `da172d7` (Feature 10); the plan below records the implemented design. Features 01–11 are complete; Feature 12 is next.

**Outcome and scope:**

Make the four existing scanner singletons available as one ordered `Scanner[]` dependency to the scan module. This feature composes providers; actual scanner execution and `ScanService` constructor injection belong to Feature 12. Discovery, the temporary failed-gate result, CLI exits, and output remain unchanged. No dependency, engine, domain-contract, scanner-algorithm, scoring, or reporter change is needed.

**Design decisions:**

- Define `export const SCANNERS = Symbol("SCANNERS")` in `src/scanners/scanner.tokens.ts`. Import that same token everywhere; do not recreate symbols or use a string/global-symbol registry.
- Keep the existing four concrete providers in `ScannersModule`. Add a private factory provider typed `FactoryProvider<Scanner[]>`, with `inject: [GitScanner, BuildScanner, TestScanner, EnvScanner]` and an explicitly typed factory returning `[git, build, test, env]`. Nest supplies the existing instances; the factory does not construct or execute scanners.
- Preserve the documented `Scanner[]` shape. Use the explicit factory order and test it against `SCAN_ORDER`; do not sort, discover providers dynamically, add a registration API, or introduce runtime validation for this fixed internal registry. Tests enforce membership and weight invariants.
- Export `SCANNERS` alongside the existing concrete exports, which are used by current scanner tests and native probes. Import `ScannersModule` into `ScanModule` alongside `InfrastructureModule`. Keep `ScanModule` exporting only `ScanService`; its downstream command layer does not need scanner access.
- Leave `ScanService` unchanged until orchestration consumes the registry. Module construction must not invoke `run()`, read target project files, or start Git/npm. Missing DI dependencies remain bootstrap failures handled by the existing safe boundary; no partial-registry fallback is added.

**Compatibility and documentation evidence:**

Manifest, lockfile, and installed Nest common/core/testing agree on 11.2.5. Inspected installed `FactoryProvider`, `InjectionToken`, and `ModuleMetadata` declarations and factory-dependency resolution in Nest core. These APIs support symbol tokens, typed factory values, explicit injection arrays, and token exports within the existing Node >=22.12 / strict NodeNext toolchain. No relevant installed Nest skill or documentation MCP tool was advertised.

The official [custom-provider documentation](https://docs.nestjs.com/fundamentals/custom-providers) describes ordered factory injection and exporting custom providers; [module documentation](https://docs.nestjs.com/modules) describes module visibility. The linked v11-specific documentation pages could not be fetched during planning, so installed 11.2.5 declarations/source are the version-specific evidence. No incompatible API was identified; actual composition still requires the build and DI checks below.

**Affected areas (new paths proposed):**

| Path | Responsibility |
| --- | --- |
| `src/scanners/scanner.tokens.ts` (new) | Shared symbol token |
| `src/scanners/scanners.module.ts` | Ordered factory and token export |
| `src/scan/scan.module.ts` | Import the scanner module |
| `test/unit/scanners/scanners.module.spec.ts` (new) | Registry invariants, identity, export visibility, and side-effect-free construction |
| `test/helpers/scanner-registry-probe.ts` (new), `test/integration/scanner-registry.integration.spec.ts` (new) | Small native probe of production `dist/` module/token composition |
| `context/scanner-registry.md`, `context/progress-tracker.md`, `context/architecture.md`, `context/library-docs.md` | Record implemented wiring and actual verification after completion |

**Ordered implementation:**

1. Add the token and factory to the existing scanner module, retaining concrete providers and exports. Use type-only imports for `Scanner` and `FactoryProvider`, plus runtime `.js` extensions.
2. Import `ScannersModule` into `ScanModule`. Do not inject an unused registry into `ScanService` or start the pipeline.
3. Add tsc-compiled DI tests and a small native production probe. Close every test module in `finally`. Native imports must obtain the token and modules from the same `dist/` tree; mixing emitted source and production symbols would test a different token.
4. Run the focused tests, then the complete quality gates below. Update the registry and tracker only with observed results; Feature 12 becomes next only after Feature 11 passes.

**Acceptance and verification:**

| Criterion | Check |
| --- | --- |
| Exactly four unique scanners in canonical order | Resolve `SCANNERS`; assert length 4, unique IDs, IDs equal `SCAN_ORDER`, and names Git/Build/Tests/Environment |
| Each weight is 25 and total is 100 | Check resolved provider weights against `SCANNER_WEIGHTS`, the individual values, and total |
| Factory reuses singleton instances | Compare each registry entry by identity with its concrete provider; repeated token resolution returns the same array |
| Token is actually exported | Compile a test-only consumer with `@Inject(SCANNERS)` in a module importing `ScannersModule`; a consumer lacking that import must fail dependency resolution. A global `moduleRef.get()` alone does not prove export visibility |
| Actual scan-module composition reaches the registry | Compile a test module importing only `ScanModule` and resolve the registry and `ScanService`; the separate consumer test above proves the export boundary |
| Registration performs no checks | Spy on scanner `run()` and adapter file/process methods; compile/resolve/close without any calls |
| Production artifacts have working DI | Native probe imports production `ScanModule` and its matching token, resolves four providers, reports only IDs/weights/identity checks, and closes cleanly; assert exit 0, expected stdout, and empty stderr |
| Existing public behavior remains intact | Existing compiled CLI tests retain help/version, shell local/CI exits 0/1, discovery/usage exits 2, safe output, and cleanup |

Run `npm run build` and `npm run test:compile`, followed by focused compiled registry tests using the installed Vitest binary. Then run `npm test -- --maxWorkers=4` with `NO_COLOR=1`; its pretest also covers both compilations. Use normal Windows process-management permissions for the full suite because the existing descendant-cleanup fixture requires them. Run `git diff --check`. No lint script is configured. Record platform limits; minimum Node, other operating systems, full pipeline fixtures, and installed-package verification remain their existing gaps.

**Planning verification:** Source, module boundaries, dependency versions, installed declarations, and documentation were inspected. No build or tests were run during planning, and no production/test implementation was changed.

**Completion:** Added the symbol, singleton factory, token export, and `ScanModule` import as planned. Six unit/DI checks and one native production check passed; `npm run build`, `npm run test:compile`, and `NO_COLOR=1 npm test -- --maxWorkers=4` passed all 252 tests across 22 files. Full tests used normal Windows process-management permissions. Scoped review found no actionable findings across plan alignment, module/contract integrity, and failure/regression coverage. Existing CLI and scanner behavior passed regression checks. No dependency or engine change was made; minimum Node, other OSes, complete scan/report execution, and packaging remain unverified. `git diff --check` passed.

---

## Phase 4 — Orchestration and Reporting

**Approved sequencing adjustment — 2026-09-28:** Feature 12's complete contract requires the `ScoringService` and `TerminalReporter` that Features 13 and 14 introduce. The user approved implementing Phase 4 in the order **13 → 14 → 12 → 15**, while retaining the feature numbers and scopes below. This keeps Feature 12 as the single integration point that activates the real pipeline. It avoids temporary orchestration result types, inline scoring, a no-op reporter, and silent execution of repository-owned build/test scripts. Feature 15 remains the compiled-CLI verification milestone for exit behavior after Feature 12 returns a real report.

### 12 Scan Orchestration

Run the complete scanner pipeline safely and sequentially.

**Status:** Implemented and verified on 2026-10-01 against clean `main` at `c55c741`, following the plan and recheck below. Feature 15 is next. The original architecture baseline was `main`/`origin/main` at `966dd72`, with Feature 11 implemented at `24c0b6a`.

**Implementation evidence — 2026-10-01:** `ScanService` and `ScanModule` were changed as planned, with no dependency, contract, scanner, scoring or reporter change. The service copies score, status and gate explicitly from the scoring projection rather than spreading it, so no additional field can enter the report. The scan unit tests now cover sequential execution, throw isolation with Error and non-Error sentinels, provider-owned identity/weight, balanced progress, a single scoring call, report identity, awaited reporting, and fatal discovery/progress/scoring/report/Clock failures.

The new `scan-orchestration-probe` resolves the compiled `ScanModule` with a controlled registry and the real scoring and reporter providers. The command probe no longer delegates to the real `scan()`, and every unprobed `scan` invocation runs from an isolated temporary project with Git ceiling isolation.

Compiled Nest testing modules that now include `ReporterModule` override `REPORTER_VERSION`, because the package-relative version loader cannot resolve from `.test-dist`. The production loader is unchanged, and native probes still use it.

`npm run build`, `npm run test:compile`, 77 focused checks across 7 files and `NO_COLOR=1 npm test -- --maxWorkers=4` passed (336 tests across 28 files). `git diff --check` also passed. Manual compiled-CLI runs against a scratch npm project exercised real npm build/test scripts and real Git. Reports and exits were correct for a dirty tree (local `0`, CI `1`), a clean READY tree (CI `0`) and missing environment names (CI `1`, names only, empty stderr, no value printed, working tree unchanged). A PTY run showed per-scanner spinners cleared before the colored report. Verified on macOS / Node 24.21.0 only.

**Prerequisite recheck — 2026-10-01:** Rechecked against clean `main` at `c55c741` (Feature 13 at `fcd9c11`, Feature 14 at `598bf99`). The implemented contracts match this plan without change: `ScoringService.calculate(readonly ScanResult[])` returns `Pick<ScanReport, "score" | "status" | "gatePassed">`; `TerminalReporter.startScanner(id, { ci })`, `stopScanner()` and `async report(report, { ci })` exist as planned; `ScoringModule`/`ReporterModule` export only those providers; `Clock` is exported by the already imported `InfrastructureModule`. `selectExitCode` keeps its narrow `Pick` parameter, so a full `ScanReport` needs no command-type change. The canonical synthesized summary `Scanner could not complete` is already listed in `cli-output-rules.md`. No new dependency or decision is needed.

The recheck identified these concrete test changes required by step 4. Each one would otherwise run `npm test` against Shipcheck's own repository after activation, either recursively or with a long delay:

- In `scan-command.integration.spec.ts`, these tests run in `process.cwd()`, which is Shipcheck's repository: "runs the temporary shell", the `observe`-mode forwarding cases, the ambient-CI case and "cleanup failure overrides the result" (`scan`/`scan --ci` without a scan probe). The `observe` mode in `scan-probe.ts` delegates to the original `scan()`, so it is affected too. Change `observe` to return a complete controlled `ScanReport` without delegating, change `ready` and its return type to `ScanReport`, and run every non-probe `scan` invocation from an isolated temporary project.
- Replace "discovers a valid project, runs the shell" with one isolated minimal-project run (`package.json` with a name and no scripts). Expected behavior: Git is not a repository (failed), Build/Test have missing scripts (failed without spawning), Environment has no example (skipped), the score is 0 and the status is NOT READY. The report goes to stdout with stderr empty; local exits `0`, CI exits `1`; the directory listing and manifest stay unchanged. Pass `GIT_CEILING_DIRECTORIES` set to the temporary root's parent, and unset `GIT_DIR`/`GIT_WORK_TREE` in that subprocess only, so an enclosing repository cannot change the Git result. Normalize the printed path before comparing. This is the single real-pipeline smoke check; Feature 15 still owns the full exit matrix and Feature 16 the representative fixtures.
- Update the `ScanService` shell unit tests (`discovers before returning the temporary gate result`) and the `scan.command.spec.ts` stubs/deferred to return complete reports built with the existing reporter fixture helper where practical.
- Documentation to correct alongside: README scan description and command table, `architecture.md` temporary-shell notes (Features 03, 11 and the infrastructure paragraph), and the `cli-output-rules.md` sequencing note.

**Outcome and scope:**

Replace the temporary failed-gate shell with the real orchestration path. `ScanService.scan()` discovers the current project, executes exactly the four registered scanners sequentially, converts an unexpected throw from one scanner into its own safe `error` result, calculates readiness through `ScoringService`, assembles one complete `ScanReport`, renders it once through `TerminalReporter`, and returns that same report to `ScanCommand`. The command remains the owner of process exit selection.

This feature connects existing components. It does not change scanner algorithms, score policy, reporter formatting, output tokens, CLI options, discovery rules, subprocess behavior, or package-manager/language support. It adds no dependency. Full representative repository fixtures remain Feature 16; installed-package execution remains Feature 17.

**Prerequisite contracts supplied by Features 13 and 14:**

- `ScoringService.calculate(results)` returns `Pick<ScanReport, "score" | "status" | "gatePassed">`. It receives completed results only and owns no project metadata, duration, output, or exit behavior.
- `TerminalReporter.startScanner(id, { ci }): void` starts or no-ops the reporter-owned progress state; `stopScanner(): void` always clears it; `report(report, { ci }): Promise<void>` writes one final completed report. Await reporting before returning the report (Feature 14 planning clarification, 2026-10-01). The reporter owns all Chalk/Ora/writer/capability logic and never executes a scanner.
- `ScoringModule` and `ReporterModule` export those providers. `ScanModule` imports them with the already imported InfrastructureModule and ScannersModule. Exact method names become controlling contracts when the prerequisite feature plans are implemented; if their architecture work finds a necessary change, update this plan before Feature 12 code.

**Orchestration design:**

1. Inject `FileSystem`, `@Inject(SCANNERS) Scanner[]`, `Clock`, `ScoringService`, and `TerminalReporter` into `ScanService`. Keep the existing public `discover()` behavior and project-error mapping unchanged. Use the exported symbol instance; an interface cannot act as a Nest runtime token. Nest common/core/testing remain pinned at 11.2.5.
2. In `scan(options)`, read the whole-scan start time immediately before discovery. Discovery failure remains fatal: run no scanner, scoring, progress, or final report, and let `ProjectDiscoveryError` reach bootstrap for exit `2`.
3. Iterate the injected array with `for...of` and `await` each `scanner.run(context)` before advancing. Do not use `Promise.all`, sorting, filesystem discovery, or scanner-to-scanner calls. Pass the same `ScanContext` object to every scanner.
4. Before each scanner, call `TerminalReporter.startScanner(scanner.id, { ci: context.ci })`; always call `stopScanner()` in `finally`. Take a separate scanner-error start reading immediately before `scanner.run()`. A normal `passed`, `failed`, `skipped`, or `error` result is appended unchanged and never stops the loop.
5. Catch an unexpected `unknown` throw from an individual scanner and append one safe result using the registry provider's own identity and weight: `status: "error"`, `summary: "Scanner could not complete"`, `details: []`, and `durationMs: Math.round(clock.now() - scannerStart)`. Do not copy, serialize, log, or retain the caught value. This safety boundary handles programming/adapter surprises that concrete scanners intentionally rethrow; it does not relabel discovery, scoring, reporter, or Clock failures.
6. After all results exist, call `ScoringService.calculate(results)` exactly once. Read the whole-scan end time after scoring and before rendering, so report duration includes discovery, scanner execution, progress orchestration, and scoring, but excludes final rendering because duration is already a field in the rendered report. Round the non-negative elapsed value once with `Math.round`.
7. Assemble a complete `ScanReport` from `context.projectName`, `context.cwd`, the ordered results, calculated score/status/gate, and duration. Await `TerminalReporter.report(report, { ci: context.ci })` exactly once, then return the identical report object. `ScanCommand` awaits the service and uses its existing narrow gate selector, so output completes before `process.exitCode` is assigned.
8. Let progress, scoring, final-report, and unexpected Clock failures propagate to the existing safe bootstrap boundary. Those are command failures, not scanner results. A progress failure may stop the pipeline; the continue-after-error guarantee applies to scanner outcomes and scanner throws.

**Security and behavior boundaries:**

- The synthesized error result contains only the scanner's declared ID, display name, weight, canonical summary, empty details, and measured duration. Tests use a sentinel throw value and assert it appears nowhere in the result, rendered output, stdout, or stderr.
- Shipcheck-owned operations remain read-only. Build and test scanners execute trusted repository-owned scripts sequentially and may have side effects. No orchestration test runs Shipcheck's own `npm test` through `shipcheck scan`, which would recurse.
- The registry order remains the output/result order even when earlier checks fail, return `error`, or throw. There is exactly one result per injected registry entry; no retries or deduplication.
- Reporter/scoring failures do not fabricate a report or gate. Bootstrap prints the existing safe fatal message and selects exit `2`. A completed report is the only path to local/CI release-gate exits.

**Affected areas:**

| Path | Responsibility |
| --- | --- |
| `src/scan/scan.service.ts` | Inject collaborators; sequential loop; throw isolation; report assembly/rendering |
| `src/scan/scan.module.ts` | Import completed scoring and reporter modules |
| `test/unit/scan/scan.service.spec.ts` | Preserve discovery coverage; add orchestration, failure isolation, duration, scoring, reporting, and leakage cases |
| `test/helpers/scan-orchestration-probe.ts` (new, proposed) | Resolve production `dist/` DI with controlled registry/adapters and emit non-sensitive observations |
| `test/integration/scan-orchestration.integration.spec.ts` (new, proposed) | Verify compiled provider composition, sequential completion, report identity/content, and clean streams without real project scripts |
| `test/helpers/scan-probe.ts`, `test/unit/commands/scan.command.spec.ts` | Replace gate-only service stubs with complete reports after `scan()` returns `ScanReport` |
| `test/integration/scan-command.integration.spec.ts` | Remove temporary-shell assertions; prevent recursive self-scan; retain parser/discovery/lifecycle coverage with controlled probes |
| `README.md`, `context/architecture.md`, `context/cli-output-rules.md`, `context/library-docs.md`, `context/build-plan.md`, `context/progress-tracker.md` | Remove temporary-shell claims and record the activated pipeline and actual evidence |

The prerequisite scoring/reporter source and tests belong to Features 13 and 14 and are not Feature 12 changes.

**Ordered implementation after prerequisites:**

1. Recheck the final exported ScoringService and TerminalReporter APIs against this plan and update the plan first if the prerequisite implementation required a different contract.
2. Refactor ScanService tests around a builder that supplies FileSystem, registry, Clock, scoring, and reporter fakes. Preserve every existing discovery case before adding orchestration behavior.
3. Implement constructor injection, the sequential scanner loop, private safe-error creation, score/report assembly, one final reporter call, and full `ScanReport` return. Update ScanModule imports; verify real constructor metadata through tsc rather than assertions alone.
4. Update command mocks/probes for complete reports. Replace tests that run `shipcheck scan` against Shipcheck's own repository with injected scan results or isolated projects, avoiding recursive `npm test`. Retain real discovery failures and a minimal valid project whose missing scripts cannot execute repository code.
5. Add the production-DI orchestration probe using controlled fake scanners. Assert call ordering and streams without leaking the sentinel or invoking Git/npm. Do not duplicate Feature 16's representative fixture matrix.
6. Run focused compiled tests, then the complete suite and scoped review. Update documentation/tracker only with observed evidence and mark Feature 12 complete only when all criteria below pass.

**Acceptance and verification:**

| Criterion | Evidence |
| --- | --- |
| Discovery happens once before scanning | FileSystem reads only `<cwd>/package.json`; every scanner receives the same returned context object |
| Execution is strictly sequential | A deferred first scanner prevents the second from starting; observed start/finish order matches `git, build, test, env` |
| Ordinary failure/error does not abort | Later scanners run after earlier scanners return `failed` or `error`; original results are preserved unchanged |
| Unexpected throw becomes safe data | Throwing scanner yields the exact canonical `error` result with provider metadata and measured duration; sentinel cause is absent; later scanners still run |
| One result per registry entry | Returned/report results length and order equal the injected registry for mixed pass/fail/skip/error/throw outcomes |
| Progress lifecycle is balanced | One start/stop pair surrounds each scanner, including a throw; CI is forwarded; no second scanner starts before the first stops |
| Scoring runs once after all scanners | Scoring receives the complete ordered results and is not called after discovery failure or before the last scanner settles |
| Complete report is coherent | Project/cwd come from context; score/status/gate come from scoring; duration uses the documented boundary; no package data or internal error enters it |
| Rendering and return identity are exact | Reporter receives exactly one final report after scoring; `scan()` returns that same object only after reporting finishes |
| Non-scanner failures stay fatal | Discovery, scoring, progress, report, or Clock rejection propagates; no partial/fabricated report or gate is returned |
| Production DI works | Native probe loads production modules/tokens from one `dist/` tree, resolves ScanService, observes controlled sequential execution, exits 0, and keeps stderr empty |
| Existing CLI boundaries survive | Help/version/usage/discovery/lifecycle tests pass; command remains the only layer setting exit codes; no recursive self-scan occurs |

Run `npm run build` and `npm run test:compile`, then focused emitted orchestration tests through the installed Vitest binary. Run `NO_COLOR=1 npm test -- --maxWorkers=4` with normal Windows process-management permissions because the existing infrastructure fixture requires descendant cleanup. Run `git diff --check` and inspect runtime imports so only ScanService orchestrates and only TerminalReporter presents. No lint script is configured.

**Verification limits:** Planning inspected the source, all ordered context files, installed Nest 11.2.5 declarations, and official Nest provider/custom-provider/module documentation. No build or tests were run during planning. Minimum Node 22.12, other OSes, representative full-project fixtures, and installed package execution remain later verification gaps.

**Decisions:** The user approved the Phase 4 implementation order **13 → 14 → 12 → 15** on 2026-09-28. No Feature 12 design question remains open; implement it after the two prerequisite providers are complete.

---

### 13 Scoring Service

Implement equal-weight readiness scoring.

**Status:** Implemented and verified on 2026-09-28. The user approved the Phase 4 order **13 → 14 → 12 → 15**; Feature 14 is next. The baseline was `main`/`origin/main` at `966dd72`, plus the uncommitted Feature 12/13 planning updates in this file and `progress-tracker.md`. The design below records the implemented contract.

**Outcome and scope:**

Add a dependency-free Nest provider that converts completed scanner results into the score, readiness status, and release-gate decision required by a `ScanReport`. Export it through a dedicated `ScoringModule` so Feature 12 can consume it without duplicating policy. This feature does not run scanners, discover projects, assemble reports, print output, set exit codes, or activate the real scan pipeline. The existing temporary scan shell remains in place until Feature 12. No package or engine change is required.

**Public provider contract:**

```ts
public calculate(
  results: readonly ScanResult[],
): Pick<ScanReport, "score" | "status" | "gatePassed">
```

Use a readonly array view so scoring cannot reorder or replace the caller's result entries. Return a new projection object. Keep `ScanReport.results` itself unchanged; this method signature is the narrower provider boundary, not a domain-contract migration. `ScoringModule` provides and exports `ScoringService`; do not import the module into `ScanModule` until Feature 12 consumes it.

**Scoring algorithm:**

1. Treat every result whose status is not `skipped` as applicable. Sum its `weight` into the denominator.
2. Sum the weights of applicable `passed` results into the numerator. `failed` and `error` results remain applicable and earn zero points. A skipped result contributes to neither sum, regardless of its weight.
3. If the denominator is zero, return a score of `0`. Otherwise calculate `(passedWeight / applicableWeight) * 100` and call `Math.round` once on that final percentage. Do not round weights, intermediate sums, or individual checks.
4. Map the score using `READINESS_THRESHOLDS`: a score at least `READY` is `READY`; otherwise a score at least `REVIEW` is `REVIEW`; all lower scores are `NOT_READY`. Do not duplicate the numeric thresholds in the service.
5. Set `gatePassed` to true only when the resulting status is `READY`. `REVIEW` and `NOT_READY` both fail the gate.

Use the weight carried by each `ScanResult`. `SCANNER_WEIGHTS` defines the four scanners' canonical weights when results are created; scoring must work from the completed results it is given so skipped checks can be removed from the denominator without scanner-ID branching. The calculation is order-independent and must not sort, filter in place, mutate a result object, or retain the input.

**Trust and failure boundaries:**

- The service accepts the internal completed-result collection supplied by orchestration. Scanner registration and execution own completeness, unique IDs, canonical weights, and one result per scanner.
- Do not add runtime validation or clamping for duplicate IDs, missing scanners, unknown statuses, negative/non-finite weights, or scores outside the expected internal range. The strict domain types and provider boundaries govern these values; runtime validation would create a second scanner-result policy outside this feature.
- Empty input and an all-skipped collection are valid defensive cases: denominator zero produces `0`, `NOT_READY`, and `gatePassed: false`.
- The provider has no logger, writer, process access, environment access, Clock dependency, exception-to-result mapping, or Nest lifecycle work. Arithmetic/type failures are not converted into scan results.

**Affected files:**

| Path | Responsibility |
| --- | --- |
| `src/scoring/scoring.service.ts` (new) | Injectable pure calculation and threshold/gate mapping |
| `src/scoring/scoring.module.ts` (new) | Provide and export `ScoringService` |
| `test/unit/scoring/scoring.service.spec.ts` (new) | Table-driven policy, boundaries, immutability, and module-export coverage |
| `context/build-plan.md`, `context/progress-tracker.md` | Record the approved order, controlling design, and observed implementation evidence |
| `context/scanner-registry.md` | Verify after implementation; no entry changes are expected because scoring does not alter scanner behavior |

`context/architecture.md`, `context/cli-output-rules.md`, and `context/library-docs.md` already describe this policy and provider boundary. Update them only if implementation uncovers a real discrepancy; do not duplicate the plan. No native subprocess fixture is proposed because this provider performs synchronous arithmetic and has no platform integration. The tsc-compiled Nest test must still prove that the exported module/provider metadata works.

**Ordered implementation:**

1. Add failing table-driven tests for canonical four-scanner outcomes, skip/error handling, zero denominator, exact thresholds, rounding, and input immutability. Build reusable typed result factories without weakening strict types.
2. Add `ScoringService` with `@Injectable()`, the narrow `calculate` signature, one-pass or equivalent non-mutating aggregation, threshold mapping from the shared constants, and a new return object.
3. Add `ScoringModule` with explicit `providers` and `exports`. In the compiled unit suite, import that module into a Nest testing module, resolve the service through Nest, and close the test module in `finally`.
4. Run the focused emitted test, production/test compilation, and complete suite. Review imports and source boundaries, verify `scanner-registry.md` is still accurate, then update the tracker with observed evidence. Feature 14 becomes next only after these checks pass.

**Acceptance and test matrix:**

| Case | Expected result |
| --- | --- |
| Four 25-point passes | `100`, `READY`, gate true |
| Three passes and one failure | `75`, `REVIEW`, gate false |
| Two passes and two failures | `50`, `NOT_READY`, gate false |
| Three passes and one skip | `100`, `READY`, gate true; skipped weight absent from both sums |
| Passed plus `error` result | Error weight remains in the denominator and earns zero |
| Empty input or all skipped | `0`, `NOT_READY`, gate false |
| Weighted totals yielding 69, 70, 89, and 90 | Status changes exactly at the shared `REVIEW` and `READY` thresholds |
| Weighted totals yielding 69.4/69.5 and 89.4/89.5 | Final percentage rounds once using JavaScript `Math.round`, then threshold mapping runs |
| Frozen input array and frozen result objects | Calculation succeeds, returns the expected projection, and leaves references/values unchanged |
| Nest testing module imports `ScoringModule` | `ScoringService` resolves from the export and repeated lookup returns the module singleton |

Tests may use deliberately varied positive weights to exercise threshold and rounding boundaries that four equal 25-point production results cannot represent. This validates the method's `ScanResult` contract; it does not authorize noncanonical scanner weights in production.

**Verification:**

Run `npm run build` and `npm run test:compile`, then the emitted scoring unit file through the installed Vitest binary. Run `NO_COLOR=1 npm test -- --maxWorkers=4` with normal Windows process-management permissions because the existing infrastructure fixture requires descendant cleanup. Run `git diff --check` and a scoped source review confirming that the scoring directory has no presentation, process, filesystem, scanner execution, or exit behavior. No lint script is configured.

**Implementation evidence — 2026-09-28:** Added the pure service and exporting module with no dependency or domain-contract change. Production/test compilation and all 23 focused scoring checks passed. The full `NO_COLOR=1 npm test -- --maxWorkers=4` run passed all 275 tests across 23 files (252 prior + 23 new), including compilation. The module test injects the exported service into a consumer in the importing module, proving export visibility and singleton identity. `git diff --check` passed; scoped review found no actionable findings. Scanner registry entries remain accurate and required no edit. The module is intentionally not wired into `ScanModule` until Feature 12.

**Verification limits:** Verified on Windows / Node 24.16.0 with installed Nest 11.2.5, TypeScript 5.9.3, and Vitest 5.0.1. Full tests used normal Windows process permissions for existing fixture cleanup. Minimum Node 22.12, other operating systems, full pipeline integration, final report output, release-gate CLI behavior, representative fixtures, and installed-package execution remain later feature gates. No user-visible behavior changed, so no additional manual CLI smoke test was required.

**Open decisions:** None.

---

### 14 Terminal Reporter

Implement the complete plain and styled report.

**Status:** Implemented and verified on 2026-10-01, following the plan created against clean `main` at `4d92209`. Production/test compilation, 47 focused reporter checks and the complete 322-test suite across 27 files passed on macOS / Node 24.21.0. Manual PTY probes verified progress, style, cleanup, CI, NO_COLOR and 80-column output. Feature 12 is next under the approved order 13 → 14 → 12 → 15; ReporterModule is exported but not yet wired into ScanModule.

**Outcome and scope:**

Provide one deterministic completed report and optional temporary local progress, using the canonical output tokens. Export `TerminalReporter` through `ReporterModule`. Keep the module outside `ScanModule` until Feature 12, so public scans retain their documented temporary behavior during this feature. Do not change scanner results, discovery, scoring, command exits, or public options. No new report format, interactive prompt, terminal framework, or general logging system.

**Controlling contract and composition:**

- `startScanner(id: ScannerId, options: { ci: boolean }): void` stops any previous spinner, then starts eligible progress using the ID's canonical text. It performs no scanner work and emits no permanent row.
- `stopScanner(): void` is safe before start and after repeated stops. Stop/clear the current spinner and release its reference. Implement `OnModuleDestroy` with the same cleanup for normal Nest shutdown. No second application context or new signal-handler framework.
- `report(report: ScanReport, options: { ci: boolean }): Promise<void>` clears progress first, assembles the whole report, and awaits one stdout writer call. It never mutates the report or selects an exit. Feature 12 must await this method; its plan above now says so explicitly.
- Inject project-owned tokens for output and capabilities, plus the package version. Output supplies `writeStdout(text): Promise<void>`, `writeStderr(text): Promise<void>`, and the stdout stream used by Ora. Production writer functions use the stream write callback to resolve/reject; account for stream error events without leaving listeners behind or closing process streams. Unit writers capture text and can defer/reject completion. Reports never use the stderr writer.
- Capabilities supply stdout TTY, presence of `NO_COLOR`, and a test-mode switch. Production samples stdout/environment at the adapter boundary; unit tests inject values without modifying the developer's environment. Effective color is TTY AND no `NO_COLOR` AND no `--ci`. Effective animation additionally requires test mode to be false. Ambient `CI` must not select command mode; `FORCE_COLOR` cannot override Shipcheck's disabling conditions.
- A private async package-version provider reuses `readPackageVersion()`. Tests override it with a fixed value; the production probe exercises the real package-relative loader. No duplicated version literal, target manifest read, or bootstrap refactor. Module construction starts no spinner and writes nothing.

**Dependency decision and installed evidence:**

At planning time Chalk and Ora were absent from direct dependencies but already installed and locked transitively through nest-commander: Chalk **4.1.2**, Ora **5.4.1**. Both installed manifests require Node >=10, within the existing >=22.12 baseline. These exact versions are now direct runtime dependencies, avoiding reliance on hoisting or an unrelated major upgrade. NodeNext compilation and native ESM imports of their CommonJS default exports passed. No engine or module-system change was needed.

Inspected installed manifests, lock entries, Chalk declarations, Ora declarations/source, and Nest 11.2.5 factory-provider declarations. Consulted official [Chalk 4.1.2 documentation](https://github.com/chalk/chalk/blob/v4.1.2/readme.md), [Ora 5.4.1 documentation](https://github.com/sindresorhus/ora/tree/v5.4.1), and Nest [custom providers](https://docs.nestjs.com/fundamentals/custom-providers) / [lifecycle](https://docs.nestjs.com/fundamentals/lifecycle-events) documentation. No relevant library-specific installed skill or advertised documentation MCP was found; used official docs and installed APIs. The original dependency proposal was subsequently installed and verified as recorded above.

- Only `terminal-reporter.service.ts` imports Chalk/Ora. Use a private `new chalk.Instance({ level: colorEnabled ? 1 : 0 })`; never mutate global Chalk state. Apply only the semantic colors after plain text assembly. Color symbols, product heading, status and gate values; dim the path and detail items. Keep primary messages unstyled.
- Ora defaults to stderr and can print replacement text with `isEnabled: false`. Do not construct/start it at all when disabled. When enabled, explicitly pass the stdout stream, `isEnabled: true`, and `discardStdin: false`; retain default frames and cursor management. Use only start/stop, never succeed/fail/persist helpers. Unit tests replace the Ora package boundary with a fake, so lifecycle assertions create no timers or real animation.
- Store the spinner before calling start so a partially failed start can be cleaned up. Clear before report output and shutdown; failures propagate to the command's existing fatal boundary rather than becoming scanner results. Do not serialize errors into a report.

**Formatting and safety decisions:**

1. Centralize symbols, labels, display names, spacing, spinner text, and detail limits in one reporter-owned constants file. Render results in the supplied registry order; do not sort, deduplicate, recalculate scores, or fabricate missing results. Feature 12 owns the complete ordered collection. Use canonical names by ID.
2. Follow the literal row formula: symbol + one space + `name.padEnd(12)` + one space + summary. The pad width and explicit separator take precedence over inconsistent spacing in illustrative examples. Use `\n`, one blank line between prescribed sections, one final newline, and no extra blank line at the end.
3. Preserve canonical scanner summary casing and wording, including lowercase `npm` and `package.json`; the canonical language table takes precedence over the generic uppercase-first rule. Render the supplied score/status/gate. Count errors with failed checks. Map internal `NOT_READY` to `NOT READY`.
4. Omit optional duration suffixes in this first reporter. This preserves the canonical examples and concise output; no duration formatter or new timing line is needed. Keep the report's duration fields intact.
5. Render details only for failed Environment results, whose contract contains sorted missing names. Ignore Git/Build/Tests detail payloads and details on other Environment statuses. Preserve name order. Show the first five names; when more exist, append `  - …and N more`. This is five data items plus one overflow indicator, following the explicit environment exception to the generic five-line rule.
6. Limit each rendered plain detail line to 160 Unicode code points including the four-character `  - ` prefix and the final ellipsis when truncated. Do not split surrogate pairs. Apply style afterward; ANSI bytes do not count. Cases at 159/160/161 characters and five/six names must be explicit tests.
7. Treat project name, path, summary and detail strings as display text: remove terminal escape sequences with Node's built-in `stripVTControlCharacters`, replace remaining C0/C1 controls and line separators with spaces, and then apply line limits/style. Do not abbreviate the absolute path or wrap/truncate summaries. Normal long paths may wrap at 80 columns; readability is not a hard 80-character cap. Record these presentation clarifications in the output documents during implementation before locking snapshots.
8. The reporter accepts trusted scanner summaries, not raw process results or parsed environment maps. Control stripping is not secret detection: scanners retain responsibility for keeping values/raw output out of `ScanResult`. The reporter adds a strict details allowlist and never spreads or serializes arbitrary objects. Leakage tests use synthetic sentinel values in disallowed details/extra properties and assert their absence without promising arbitrary-secret redaction from allowed text.

**Proposed affected paths:**

| Path | Responsibility |
| --- | --- |
| `src/reporter/terminal-reporter.service.ts` (new) | Public reporter contract, formatting, style, spinner state and cleanup |
| `src/reporter/reporter.module.ts` (new) | Explicit singleton composition, version/output/capability factories, reporter export |
| `src/reporter/reporter.tokens.ts`, `output-tokens.ts` (new) | Injection identities and canonical presentation constants |
| `src/reporter/reporter-output.type.ts`, `reporter-capabilities.type.ts` (new) | Project-owned test seams, no Chalk/Ora types exposed to callers |
| `src/reporter/write-output.ts`, `test/unit/reporter/write-output.spec.ts` (new) | Callback-backed stream writes, backpressure/error ordering and listener cleanup |
| `test/unit/reporter/terminal-reporter.service.spec.ts`, `reporter.module.spec.ts` (new) | Stable snapshots, safety, capabilities, progress, writer failures, module visibility/cleanup |
| `test/helpers/terminal-reporter-probe.ts`, `test/integration/terminal-reporter.integration.spec.ts` (new) | Native production-module rendering, real metadata and stdout/stderr verification |
| `package.json`, `package-lock.json` | Declare the selected exact direct dependencies |
| Output tokens/rules, `library-docs.md`, `architecture.md`, build plan and tracker | Record interpretations, installed APIs, exported contract, observed evidence and remaining scope |

**Ordered implementation:**

1. Recheck installed versions and the narrow dependency diff; declare exact Chalk/Ora dependencies and document their use. Compile a native ESM integration through the actual toolchain. If the same failure survives one correction, use recover before trying again.
2. Reconcile output-document examples/rules with the decisions above. Add tokens, output/capability types, private version token, module factories and the exported reporter. Keep library APIs private and leave ScanModule unchanged.
3. Implement plain formatting, control stripping and environment detail limiting; then add isolated Chalk styling, Ora lifecycle and Nest cleanup. Await the final writer; never catch output failure and pretend the report completed.
4. Add focused behavior tests and stable snapshots, module export/cleanup tests, and the native production probe. Keep tests outside src and use the existing tsc → emitted Vitest workflow. The probe constructs ReporterModule with a supplied report; it never scans Shipcheck or invokes project scripts.
5. Run targeted verification, then the full build/test gate and a scoped review. Record actual results in the tracker, verify the scanner registry remains accurate, and mark Feature 14 complete only after acceptance passes. Feature 12 is next; public full-scan/report activation remains there.

**Acceptance and verification:**

| Requirement | Observable acceptance check |
| --- | --- |
| Canonical complete reports | Exact plain snapshots for READY, REVIEW, NOT READY, skipped environment and operational error; heading/version, metadata, row order/alignment, count grammar, labels, blanks and final newline |
| Safe bounded details | Zero/one/five/six/many missing names; 159/160/161-character boundaries and Unicode; overflow count correct; no mutation of frozen inputs |
| No unintended data output | Only failed-env names render as details; synthetic command-output/path/value/stack payloads in forbidden fields are absent; no object serialization |
| Terminal text cannot inject rows/controls | ANSI/OSC, CR/LF, tabs and control characters in display fields cannot create extra report lines or active escape sequences |
| Capability policy | Table-driven TTY/non-TTY, ci true/false, NO_COLOR absent/empty/non-empty and test-mode cases; disabled progress writes nothing and never calls Ora |
| Styling is isolated | Enabled TTY output has semantic ANSI colors; stripping ANSI yields the identical plain report; global Chalk state and process environment remain unchanged |
| Progress is balanced | Correct text for each ID; start→start stops the prior spinner; repeated stop is safe; report and module close clear progress; no persist calls; failed start is cleaned up |
| Output finishes or fails honestly | Deferred writer keeps report promise pending; synchronous/async writer failures reject; spinner stops before the write; stderr stays empty for every completed outcome |
| Real module/export integration | Consumer in an importing Nest module receives singleton TerminalReporter; native probe loads dist identities, reads real package version from unrelated cwd, writes expected stdout and exits cleanly with empty stderr |
| Scope stays unchanged | Existing CLI help/version/discovery/shell and scanner/scoring tests pass; reporter construction is silent; no ScanModule wiring or exit-code writes |

Run `npm run build`, `npm run test:compile`, and focused emitted reporter tests; then `NO_COLOR=1 npm test -- --maxWorkers=4` and `git diff --check`. No lint script exists. Manually run the compiled reporter probe in a local TTY to observe spinner cleanup/color and at 80 columns, then piped/NO_COLOR/CI modes to inspect plain output. Use fake Ora in automated tests; do not confuse injected TTY capability tests with actual terminal verification. Repeat native checks on Windows and minimum Node when available, and record gaps honestly. Feature 12/15 tests must additionally verify awaited reporting precedes command exit selection; Feature 16/17 retain full-scan fixtures and installed-package verification.

**Open questions and limits:** No blocking product decision remains. Output documents now record the formatting interpretations above; no scanner policy changed. Planning itself did not install packages or run checks; the status above records subsequent implementation evidence. Windows and minimum Node 22.12 remain unverified for the reporter. Full-pipeline fixtures and installed packaging remain later features. Rollout is the later ScanModule import in Feature 12; this feature needs no migration or deployment.

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
