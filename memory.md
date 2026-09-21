# Shipcheck project memory

Updated: 2026-09-21 12:06:25 UTC (13:06:25 Africa/Lagos)
Revision: `main` at `5a1a0975ebcba5be65f68c916064ea00586f90e8`; Feature 04 and this handoff are uncommitted
Remote: https://github.com/Cyrus-11/ship-check.git

## Objective and scope

Build Shipcheck v0.1, a NestJS standalone release-readiness CLI for Node.js/TypeScript projects using npm. Follow [AGENTS.md](AGENTS.md), including its ordered context reading on a new session. **01–03 are complete and pushed. 04 Domain Contracts and Constants is implemented, tested, and reviewed but not committed or pushed. 05 Infrastructure Adapters is next and has not started.**

Public v0.1 scope is help, version, `scan`, and `scan --ci`. Exactly four sequential scanners are planned: Git, Build, Tests, Environment. No HTTP server, database, frontend, configuration system, extra scanners, or public npm publication. Shipcheck-owned operations are read-only; repository-owned build/test scripts can have side effects. Never expose environment values, subprocess output, or error stacks in reports.

## Current state

- Context filenames and scan side-effect/mutation rules were corrected in the scaffold session. Documentation was pushed as `db3fd60`; scaffold as `acb197b`.
- Feature 03 was committed and pushed to `origin/main` as `5a1a097` (`feat: implement scan command shell`). HEAD and origin/main matched afterward and again before this save. Feature 02's older handoff was committed as `b1929e0`; the previous memory's claim that it was uncommitted is superseded.
- The working tree contains Feature 04's source/test/documentation edits and this consolidated `memory.md`. HEAD and the local origin/main ref still match at the Feature 03 commit; no new fetch, commit, or push was performed for this review/save.
- `src/main.ts` preserves the shebang and reflect-metadata import and invokes `src/bootstrap.ts`. `AppModule` imports `CommandsModule`, which registers root and scan providers and imports `ScanModule`, exporting `ScanService`.
- Product help, aliases, bare invocation, and package-derived version work from any working directory. Invalid flags, unknown commands, and positional paths exit 2. Help/version exit 0 after asynchronous Nest cleanup.
- `ScanCommand` accepts boolean `--ci` and built-in help, normalizes absent options to local mode, awaits one service call, then selects an exit through `src/commands/select-exit-code.ts`. Ambient `CI=true` does not enable the CLI mode. Value-bearing/negated CI flags and positional paths are rejected.
- **The scan service is a development shell:** `src/scan/scan.service.ts` returns `{ gatePassed: false }`, performs no discovery/checks, and prints no report. Local execution exits 0; CI exits 1. These are placeholders, not readiness assessments. README states this explicitly.
- `src/common/package-version.ts` loads Shipcheck's own manifest via a package-relative native JSON import. Feature 04 reuses `src/common/constants/exit-codes.ts` unchanged.
- Feature 04 adds eight shared contracts/types: Scanner interface plus ScannerId, ScanStatus, ReadinessStatus, PackageJson, ScanContext, ScanResult, and ScanReport. Primary types live under `src/common/types/`; the scanner interface lives under `src/common/contracts/`.
- `src/common/constants/scan-order.ts` defines frozen SCAN_ORDER; ScannerId derives from that tuple. `scoring.ts` defines frozen SCANNER_WEIGHTS (25 each, total 100) and READINESS_THRESHOLDS (READY 90, REVIEW 70). These are policy data, not the scanner injection registry or scoring implementation.
- Deleted `src/scan/scan-shell-report.type.ts`. The service, exit selector, command unit test, and scan probe now use `Pick<ScanReport, "gatePassed">`. No fabricated full report was added. Six obsolete generated files were removed from `dist/scan/` and `.test-dist/src/scan/`; no old type references remain in source/tests/generated output.
- Added five runtime policy tests at `test/unit/common/constants.spec.ts` and compiler-only examples at `test/typechecks/domain-contracts.ts`. The latter uses an uncalled function with explained expected errors and is included by the existing test tsconfig, not executed by Vitest.
- [Progress tracker](context/progress-tracker.md) marks 01–04 complete. [Build plan](context/build-plan.md) records Feature 04's design and verification. README, architecture, and library docs describe the new contracts and preserved shell behavior.
- Infrastructure adapters, project discovery, scanners, scoring, reporting, real scan integration fixtures, and installed-package smoke tests remain unfinished. [Scanner registry](context/scanner-registry.md) accurately marks all four scanners and the registry provider as not started.

## Decisions and lessons

- User explicitly selected **MIT** licensing. Package remains `private: true` because publication is outside implementation scope.
- Runtime baseline: Node 22.12+, native ESM, strict TypeScript, `.js` relative imports. Verified development environment: Windows, Node 24.16.0, npm 11.13.0.
- Pinned Nest common/core/testing **11.2.5**, nest-commander **3.21.0**, TypeScript **5.9.3**, Vitest **5.0.1**, Execa **10.0.1**, reflect-metadata **0.2.2**, RxJS **7.8.2**, and @types/node **22.20.4**.
- Do not blindly upgrade to Nest 12: nest-commander's advertised peers accept it, but its discovery dependency 7.0.3 requires Nest `^11.1.21`. The initial Nest 12 install warned; the corrected Nest 11 tree passed strict peer validation. See [library decisions](context/library-docs.md).
- `npm test` builds production code and compiles tests with `tsc` before running Vitest on `.test-dist/test/**/*.spec.js`. This preserves constructor metadata and proves dependency injection using the same compiler options as production. Test sources stay in `test/`; production output contains no tests.
- Vitest 5's Node range is narrower than the runtime baseline: use Node 22.12+ on 22.x or Node 24.x for development. Node 24.16.0 was tested.
- Execa is currently used by the test harness; future runtime subprocesses belong behind ProcessRunner. Test harnesses may read artifacts directly; runtime project reads belong behind FileSystem.
- Feature 03 completed the previously approved deferred root-help scan listing. Help now follows the framework's observed Options-before-Commands order; no custom renderer was added.
- nest-commander 3.21.0 wraps Commander 11.1.0. `cliName` alone does not set displayed usage; `@RootCommand()` supplies product metadata. The root provider disables excess arguments and the implicit `help` subcommand; bare invocation prints help.
- Child commands are constructed independently and attached with `addCommand()`, so root strictness and exit overrides do not propagate. In installed nest-commander, `allowExcessArgs: false` metadata does not disable Commander's permissive default. `ScanCommand.setCommand()` explicitly calls `allowExcessArguments(false)` and `exitOverride(throwParserExit)`.
- Parser exit overrides must throw: returning allows Commander to call `process.exit()` before cleanup. Feature 03 replaced root-only captured-object identity with a shared `ParserExitSignal` wrapper in `src/commands/parser-exit.ts`, used by root and scan overrides. Bootstrap recognizes only this wrapper, applies parser exits after factory close, and preserves command-selected exits. Cleanup failure overrides success. Do not replace this with an error handler that merely sets exitCode.
- The shell's gate-only return is now a projection of the full ScanReport. The selector permanently needs only the gate field; real orchestration can later return a complete report without changing that dependency. Do not weaken full-report fields or invent metadata/results to satisfy the shell.
- PackageJson is a validated readonly subset with optional string name and build/test scripts, not untrusted JSON. Feature 06 must narrow unknown input and select string fields, omitting non-string/unsupported fields. Missing/blank name fallback and missing/blank script behavior remain as documented; no new fatal metadata rules were added.
- ScanContext and nested package metadata are readonly at the TypeScript boundary, not runtime deep-frozen. ScanResult/ScanReport fields are required; their arrays remain mutable as specified. Number types do not enforce ranges or score/status/gate consistency; future providers own those runtime invariants.
- Type-only imports keep domain contracts independent of Nest, Commander, and terminal libraries. The weight map uses `as const satisfies Record<ScannerId, number>` to reject missing/extra keys. No dependency, engine, compiler setting, scanner registration, or CLI behavior changed in Feature 04.
- Unexpected errors, including errors that resemble successful help signals, produce fixed safe stderr and exit 2. Usage diagnostics contain a stable help hint, not raw arguments. Factory cleanup applies after application creation succeeds; startup rejection does not expose a partial context to close.
- Vitest's in-process data-URL import path dropped JSON import attributes (`ERR_IMPORT_ATTRIBUTE_MISSING`). Native subprocess tests now load the production metadata reader. Keep these tests native instead of changing the runtime loader or dropping validation cases.
- Test helpers preload production modules to observe option forwarding and inject gate outcomes, startup/execution/cleanup failures, and asynchronous shutdown hooks. These exist only under `test/`; production has no test switches.
- The sandbox and user have different Windows ownership. A Git `safe.directory` entry was added for this exact workspace. Git metadata writes/network operations required tool escalation; do not weaken ownership checks globally or force-push.
- Automatic approval review initially rejected the Feature 03 push for lacking destination-specific authorization. After the user explicitly confirmed `Cyrus-11/ship-check`, branch `main`, the normal push succeeded. This is resolved and is not authorization for unrelated future pushes.
- During final documentation edits, the patch helper briefly failed with a Windows sandbox setup access error and longer fallback shell edits stalled. Those processes were stopped; a minimal write worked and the patch helper subsequently recovered. The temporary write probe was removed. No application change was needed; evidence is in the tracker.
- During Feature 04, a patch partially landed before failing to create `src/common/contracts`. Inspected landed files, created the directory, and applied only remaining edits successfully. A later shell check stalled; stopped it and ran the shorter check with `login: false`, which passed. Avoid blindly replaying partial patches or leaving stalled sessions running.

## Verification already performed

- Final `npm install --no-audit --no-fund --strict-peer-deps`: passed without warnings; Nest dependencies deduplicated to 11.2.5.
- Feature 04 `npm test` with `NO_COLOR=1`: production build, test compilation, compiler-only positive/negative contract checks, and all **75 tests across 7 files passed** (6 scaffold, 4 bootstrap-boundary, 7 command/DI, 5 domain policy, 20 bootstrap CLI, 8 native metadata, 25 scan shell cases).
- Contract examples verify valid typed objects, closed IDs/statuses, required duration/weight/report fields, asynchronous scanner methods, readonly identity/context/package fields, string metadata, weight-key coverage, and full-report compatibility with the exit selector. Runtime policy tests verify exact order/IDs, 25-point weights totaling 100, thresholds, exits, and frozen constants.
- Tests cover root/scan help, version/aliases, working-directory independence, strict argument/option rejection, actual option forwarding, ambient CI independence, the four-case gate/exit matrix, awaiting service completion, service rejection/lookalike errors, asynchronous child help/usage cleanup, and cleanup overrides. Plugin discovery, no target discovery/mutation by the shell, no network listener, safe errors/secret-marker checks, constructor DI, and existing packaging metadata checks remain covered.
- Earlier Feature 03 manual compiled help/version returned 0; local shell returned 0, CI shell 1, invalid scan option 2 with safe stderr. Feature 04's compiled integration suite reverified these flows; no separate manual smoke was repeated because public behavior did not change.
- `git diff --check` passed for Feature 04 and again during this review. The staged check passed for the earlier Feature 03 commit; Feature 04 has not been staged. Generated `node_modules/`, `dist/`, and `.test-dist/` remain ignored.
- Feature 03 push advanced GitHub `main` from `b1929e0` to `5a1a097`. Local HEAD and origin/main still match there; Feature 04 and this handoff remain uncommitted.
- Feature 04 implementation review and the user's subsequent review-before-save found no actionable findings. Reviewed plan alignment, all new source/test files, domain/consumer boundaries, emitted declarations, stale-artifact removal, docs, and regression coverage. The second review reused the unchanged implementation's successful test run, reran diff checks, and confirmed no obsolete type references; it did not rerun the suite or alter product code.
- Limits: Windows / Node 24.16.0 only; Node 22.12, other OSes, installed npm launchers/packaging, and real scan/report fixtures remain unverified. No claim that v0.1 is complete or that tests prove every possible failure absent.

## Commands available now

```powershell
npm run build
node dist/main.js --help
node dist/main.js --version
node dist/main.js scan --help
node dist/main.js scan
node dist/main.js scan --ci
npm test
npm run dev
```

`dev` watches and recompiles source; run the compiled CLI separately. There is no server. Scan commands currently exercise only the development shell described above.

## Next step

Feature 04 is ready for a requested commit/push; do not assume this review/save authorized publishing it. Its new source and test files are still untracked and must be included when staging the feature.

Plan **05 Infrastructure Adapters** when requested, following [the build plan](context/build-plan.md): ProcessRunner, FileSystem, Clock, InfrastructureModule, and process-start error contract. Re-read installed Execa 10.0.1 docs/types before integrating. Resolve exit, timeout, spawn failure, bounded captured output, environment preservation, and Windows npm executable behavior without shell command strings. FileSystem must expose read-only project operations, with exists returning false only for expected ENOENT. Clock supplies a monotonic timing seam. Keep discovery and actual scanners in later features.

Retain the tsc/native-subprocess test patterns, reuse the completed domain contracts/constants, run relevant checks, and update tracker/registry as appropriate. No unresolved user decision or known blocker remains. This save does not start Feature 05 or request a commit/push.
