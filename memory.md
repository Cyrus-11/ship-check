# Shipcheck project memory

Updated: 2026-09-21 19:45:34 UTC
Revision: main at 9a86f0ba1390992626a7bf6e5147a7e87d0bde48 (feat: add domain contracts and constants)
Remote: https://github.com/Cyrus-11/ship-check.git
Working tree: Feature 05 source/tests/context changes and this handoff are uncommitted. Local origin/main matches HEAD; no fetch was performed for this save.

## Objective and current state

Build Shipcheck v0.1, a NestJS standalone release-readiness CLI for Node.js/TypeScript repositories using npm. Follow [AGENTS.md](AGENTS.md), including ordered context reading on a new session. **Features 01–04 are complete and pushed. Feature 05 Infrastructure Adapters is implemented, verified, and reviewed but not committed or pushed. Feature 06 Project Discovery and Scan Context is next.** No unresolved decision or blocker remains.

Scope stays help, version, scan, and scan --ci, with four sequential scanners: Git, Build, Tests, Environment. No HTTP server, database, frontend, configuration system, extra scanners, other package managers, or public npm publication. Shipcheck-owned operations are read-only; repository-owned build/test scripts can have side effects. Never expose environment values, raw subprocess output, or error stacks in reports.

Detailed evidence lives in [progress-tracker.md](context/progress-tracker.md), plans in [build-plan.md](context/build-plan.md), and library decisions in [library-docs.md](context/library-docs.md). The previous memory's claim that Feature 04 was uncommitted is superseded.

## Implemented behavior and boundaries

- Bootstrap runs once through CommandFactory; main preserves the shebang and reflect-metadata import. CommandsModule registers root/scan commands and imports ScanModule. Help/version work independently of target cwd; version comes from Shipcheck's own manifest.
- **ScanService remains a development shell:** it returns a failed gate as Pick<ScanReport, "gatePassed">, performs no discovery/checks, and prints no report. Local/CI shell exits are 0/1; usage/unexpected failures exit 2. Ambient CI does not select CLI mode.
- Feature 04 added domain types and Scanner under src/common/, frozen SCAN_ORDER (git, build, test, env), weights of 25 each, and READY/REVIEW thresholds of 90/70. It reused exit constants and removed ScanShellReport plus obsolete generated artifacts.
- Feature 05 adds process-request.type.ts and process-result.type.ts under src/common/types/, and src/infrastructure/: ProcessRunner, FileSystem, Clock, InfrastructureModule, operational errors, and execution limits. The module exports its providers but is not connected to the scan shell. No dependency changed.
- ProcessRunner uses separate executable/arguments, shell:false, closed stdin, captured output, explicit absolute cwd/timeouts, and an inherited environment snapshot plus overrides. It never mutates request or parent environment. Windows keys are normalized; undefined removes a key. Future TestScanner supplies CI: "true".
- Ordinary numeric exits are unchanged. Timeout returns timedOut:true with synthetic exitCode 1. Missing executable/cwd and start failures throw ProcessStartError; invalid requests, output limits, signals/cancellation, and other operational failures throw ProcessExecutionError. Public messages are fixed; causes/output stay internal.
- Execa text buffers count characters: capture uses encoding:buffer with 1,000,000 bytes per stream, then UTF-8 decoding. Check failure flags before numeric exits: buffer failure can have exitCode 0. Timeout inputs are integers from 1 through 2,147,483,647 ms. Central limits provide Git 10 seconds, build/test 120 seconds, and termination grace 5 seconds.
- The user approved Execa's internal cmd.exe launcher for resolved npm.cmd while retaining shell:false and prohibiting Shipcheck-built shell strings. Architecture/standards record this exception. Windows supports native .exe/.com and npm.cmd; arbitrary shebang/batch launchers and metadata-denied App Execution Aliases fail safely.
- FileSystem owns runtime node:fs/promises reads: UTF-8 readText, exists (false only for ENOENT), and Windows executable lookup. Lookup checks PATH/PATHEXT, quoted directories, extension/case rules, and current-directory control before Execa so missing commands cannot appear as ordinary exit 1. Clock uses monotonic performance.now().
- Discovery, actual scanners/registry, scoring, reporting, real scan fixtures, and installed-package smoke tests remain unfinished. [Scanner registry](context/scanner-registry.md) accurately marks all four scanners and their registry provider as not started.

## Durable decisions and lessons

- MIT license; package remains private. Baseline: Node >=22.12, native ESM, strict TypeScript NodeNext, runtime .js relative imports. Verified environment: Windows, Node 24.16.0, npm 11.13.0.
- Pinned Nest common/core/testing 11.2.5, nest-commander 3.21.0, TypeScript 5.9.3, Vitest 5.0.1, Execa 10.0.1, reflect-metadata 0.2.2, RxJS 7.8.2, @types/node 22.20.4. Do not blindly upgrade Nest: the discovery dependency required Nest 11 despite nest-commander advertising Nest 12 compatibility. The current tree passed strict peer installation. Use a Node version supported by Vitest for development; Node 24 was verified.
- npm test builds production and compiles tests with tsc, then Vitest runs .test-dist/test/**/*.spec.js. This preserves real Nest constructor metadata. Test helpers may access files/processes directly; runtime consumers use adapters. Production has no test switches or test files.
- nest-commander child commands do not inherit root strictness/exit overrides. ScanCommand.setCommand explicitly disables excess arguments and uses the shared throwing parser override. Returning from an override permits Commander to exit before cleanup. Bootstrap recognizes only ParserExitSignal, applies exits after cleanup, and lets cleanup failures override success.
- Native subprocess tests are necessary for the package-version JSON loader: Vitest's in-process data-URL imports dropped JSON attributes. Do not weaken the runtime loader to accommodate that transform.
- PackageJson is a validated readonly subset, not arbitrary JSON. Feature 06 must narrow unknown input and select string name/build/test fields, omitting non-string/unsupported fields. Preserve documented blank-name fallback and missing-script behavior. Context/package readonly is compile-time protection, not runtime deep freezing. Report consistency belongs to later providers.
- The exit selector permanently needs only the report gate field. Do not weaken complete ScanReport fields or invent results/metadata to satisfy the temporary shell.
- Execa's full generic result conflicted with exactOptionalPropertyTypes. A private Pick of consumed fields resolved this without production assertions or Execa types in public contracts.
- Windows taskkill was denied inside the tool sandbox. Execa killed only the direct process, leaving descendants/pipes alive. Confirmed permission failure, identified and terminated only fixture-owned ancestry with normal permissions, and removed the leftover fixture. Process-tree checks passed outside the sandbox. Cleanup is best-effort, not containment or a hard deadline.
- The tree fixture records script/child PIDs and has independent emergency cleanup. Under the full parallel suite, the original two-second npm timeout expired before script startup. Recovery traced the missing PID marker; matching the ten-second npm smoke allowance fixed the test timing issue.
- Patch/shell helpers sometimes stall or fail Windows sandbox setup. Inspect partial edits before retrying, stop stalled sessions, and prefer short commands with login:false. Long PowerShell handoff writes stalled again during this save; the session was stopped and the patch tool used instead. Do not blindly replay edits or weaken Git ownership checks; the workspace-specific safe.directory entry already exists.
- Earlier push approvals applied to their specific destinations/payloads. This save does not authorize a new commit/push or implementation of Feature 06.

## Verification

- Final Feature 05 npm test with NO_COLOR=1 and normal Windows process-management permissions passed production build, test compilation, compiler-only domain checks, and **139 tests across 11 files**: 75 prior checks plus 52 infrastructure unit/DI checks and 12 native integration checks.
- Native coverage: actual output/exits, literal arguments/stdin EOF, unavailable command/cwd, timeout, Unicode output limits on both streams, npm build/test in a directory with spaces, CI/environment preservation, npm descendant cleanup, filesystem reads, Windows case matching, and production Nest injection without listener/log noise.
- Unit coverage: safe errors, signals/cancellation/I/O failures, malformed results, invalid requests, Windows lookup/access errors, environment casing/removal, and clock/DI. Existing help/version/usage/exit/cleanup checks remain passing.
- Scoped review covered plan alignment, adapter boundaries, emitted declarations, output/error safety, environment immutability, and verification evidence. No actionable findings remained within the reviewed scope.
- git diff --check passed after implementation and before this save. No application edits or suite rerun were needed for the handoff.
- Limits: minimum Node 22.12, POSIX native signals/process groups, installed Shipcheck packaging, and real scan/report fixtures remain unverified. Windows npm adapter execution is verified; v0.1 is not complete.

## Next steps

1. Feature 05 is ready for a user-requested commit/push. Include currently untracked source/test files and this handoff when staging; saving alone does not authorize Git writes.
2. When asked to continue product work, architect **06 Project Discovery and Scan Context**: resolve cwd once, read only its package.json through FileSystem, validate the root, select supported string metadata, apply directory-name fallback, and create immutable ScanContext with safe fatal discovery errors. Never search parent projects.
3. Preserve the staged shell/pipeline boundary, reuse existing contracts/adapters, add targeted discovery checks and run affected gates, then update tracker/registry as appropriate.

Available commands: npm run build, npm test, npm run dev, and node dist/main.js with --help, --version, scan --help, scan, or scan --ci. Dev watches/recompiles only; there is no server.
