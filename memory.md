# Shipcheck project memory

Updated: 2026-09-20 20:00:36 UTC (21:00:36 Africa/Lagos)
Revision: `main` at `1ca408bf60d9716e1125d394e5c54195648becbc`
Remote: https://github.com/Cyrus-11/ship-check.git

## Objective and scope

Build Shipcheck v0.1, a NestJS standalone release-readiness CLI for Node.js/TypeScript projects using npm. Follow [AGENTS.md](AGENTS.md), including its ordered context reading on a new session. **01 Project Scaffold** and **02 Nest Standalone CLI Bootstrap** are complete and pushed. **03 Scan Command Shell** is next and has not been implemented.

Public v0.1 scope is help, version, `scan`, and `scan --ci`. Exactly four sequential scanners are planned: Git, Build, Tests, Environment. No HTTP server, database, frontend, configuration system, extra scanners, or public npm publication. Shipcheck-owned operations are read-only; repository-owned build/test scripts can have side effects. Never expose environment values, subprocess output, or error stacks in reports.

## Current state

- Context filenames and scan side-effect/mutation rules were corrected in the scaffold session. Documentation was pushed as `db3fd60`; scaffold as `acb197b`.
- Feature 02 was committed and pushed to `origin/main` as `1ca408b` (`feat: implement Nest standalone CLI bootstrap`). The push succeeded, and local HEAD matched origin/main afterward.
- Only `memory.md` was modified before this save. It was deliberately excluded from the feature commit because it contained an older handoff. This updated save remains local and uncommitted; no new fetch was performed for this save.
- `src/main.ts` preserves the shebang and reflect-metadata import and invokes `src/bootstrap.ts`. `AppModule` imports `CommandsModule`, which registers `RootCommand`.
- Product help, aliases, bare invocation, and package-derived version work from any working directory. Invalid flags, unknown commands, and positional paths exit 2. Help/version exit 0 after asynchronous Nest cleanup.
- `src/common/package-version.ts` loads Shipcheck's own manifest via a package-relative native JSON import. `src/common/constants/exit-codes.ts` supplies shared exit codes, introduced at first use; feature 04 will reuse it.
- [Progress tracker](context/progress-tracker.md) marks 01 and 02 complete. [Build plan](context/build-plan.md) records the completed feature 02 architecture and verification. README, architecture, output rules, and library docs reflect actual behavior.
- `scan`, `--ci`, project discovery, scanners, scoring, reporting, and installed-package smoke tests remain unfinished. [Scanner registry](context/scanner-registry.md) still accurately marks all four scanners and the registry provider as not started.

## Decisions and lessons

- User explicitly selected **MIT** licensing. Package remains `private: true` because publication is outside implementation scope.
- Runtime baseline: Node 22.12+, native ESM, strict TypeScript, `.js` relative imports. Verified development environment: Windows, Node 24.16.0, npm 11.13.0.
- Pinned Nest common/core/testing **11.2.5**, nest-commander **3.21.0**, TypeScript **5.9.3**, Vitest **5.0.1**, Execa **10.0.1**, reflect-metadata **0.2.2**, RxJS **7.8.2**, and @types/node **22.20.4**.
- Do not blindly upgrade to Nest 12: nest-commander's advertised peers accept it, but its discovery dependency 7.0.3 requires Nest `^11.1.21`. The initial Nest 12 install warned; the corrected Nest 11 tree passed strict peer validation. See [library decisions](context/library-docs.md).
- `npm test` builds production code and compiles tests with `tsc` before running Vitest on `.test-dist/test/**/*.spec.js`. This preserves constructor metadata and proves dependency injection using the same compiler options as production. Test sources stay in `test/`; production output contains no tests.
- Vitest 5's Node range is narrower than the runtime baseline: use Node 22.12+ on 22.x or Node 24.x for development. Node 24.16.0 was tested.
- Execa is currently used by the test harness; future runtime subprocesses belong behind ProcessRunner. Test harnesses may read artifacts directly; runtime project reads belong behind FileSystem.
- The user approved moving the acceptance criterion that root help lists `scan` from feature 02 to feature 03. Do not advertise or register a fake scan command. The final v0.1 help surface is unchanged.
- nest-commander 3.21.0 wraps Commander 11.1.0. `cliName` alone does not set displayed usage; `@RootCommand()` supplies product metadata. The root provider disables excess arguments and the implicit `help` subcommand; bare invocation prints help.
- The factory's `errorHandler` must throw its parser signal: returning allows Commander to call `process.exit()` before cleanup. `serviceErrorHandler` recognizes the same captured object, handles help/version and usage, and rethrows unexpected errors. Bootstrap sets parser exit codes after factory close; cleanup failure overrides success. Do not replace this with an error handler that merely sets exitCode.
- Unexpected errors, including errors that resemble successful help signals, produce fixed safe stderr and exit 2. Usage diagnostics contain a stable help hint, not raw arguments. Factory cleanup applies after application creation succeeds; startup rejection does not expose a partial context to close.
- Vitest's in-process data-URL import path dropped JSON import attributes (`ERR_IMPORT_ATTRIBUTE_MISSING`). Native subprocess tests now load the production metadata reader. Keep these tests native instead of changing the runtime loader or dropping validation cases.
- Test helpers preload the production modules to verify real asynchronous shutdown and inject startup/execution/cleanup failures. These hooks exist only under `test/`; production has no test switches.
- The sandbox and user have different Windows ownership. A Git `safe.directory` entry was added for this exact workspace. Git metadata writes/network operations required tool escalation; do not weaken ownership checks globally or force-push.
- During final documentation edits, the patch helper briefly failed with a Windows sandbox setup access error and longer fallback shell edits stalled. Those processes were stopped; a minimal write worked and the patch helper subsequently recovered. The temporary write probe was removed. No application change was needed; evidence is in the tracker.

## Verification already performed

- Final `npm install --no-audit --no-fund --strict-peer-deps`: passed without warnings; Nest dependencies deduplicated to 11.2.5.
- Final feature 02 `npm test` with `NO_COLOR=1`: production build, test compilation, and all **38 tests across 4 files passed** (6 scaffold, 4 bootstrap-boundary, 20 CLI integration, 8 native metadata cases).
- Tests cover product help/version/aliases, working-directory independence, strict usage rejection, plugin discovery disabled, no target mutation for help/version, no network listeners, constructor DI, safe errors, and asynchronous shutdown. Existing packaging metadata/shebang/no-HTTP-adapter checks remain intact.
- Manual `node dist/main.js --help` and `--version`: exit 0 with correct output; `--unknown`: exit 2 with safe usage hint. No Nest logs.
- `git diff --check` and staged diff check passed before the feature commit. Generated `node_modules/`, `dist/`, and `.test-dist/` remain ignored.
- Feature 02 push to `origin/main` succeeded. Current local HEAD and remote-tracking ref still match; memory is the only uncommitted file.
- Scoped review found no actionable feature 02 issues. Limits: Windows / Node 24.16.0 only; Node 22.12, other OSes, installed npm launchers/packaging, and scan integration fixtures remain unverified. No tests rerun solely for this memory save.

## Commands available now

```powershell
npm run build
node dist/main.js --help
node dist/main.js --version
npm test
npm run dev
```

`dev` watches and recompiles source; run the compiled CLI separately. There is no server to start and no implemented `scan` command yet.

## Next step

Plan and implement **03 Scan Command Shell** when requested, following [the build plan](context/build-plan.md): register ScanCommand, add only the boolean `--ci` option and typed options, use a temporary ScanService contract returning a minimal report, and add the central exit selector. Complete root help's scan listing and scan help's `--ci` description. Keep real scanners and discovery in their later features.

Inspect installed option-parser and child-command behavior before editing integration code. Verify child help/usage exits still finish cleanup, reject path arguments/unknown flags, and preserve the command-selected exit code. Reuse the existing EXIT_CODE constants and tsc/native-subprocess test patterns.

Keep feature work sequential, update the tracker after completion, and verify scanner-registry accuracy. No unresolved user decision or known blocker remains. This save request does not itself start feature 03 or request another GitHub push.
