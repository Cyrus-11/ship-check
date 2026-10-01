# Shipcheck project memory

Updated: 2026-10-01 13:22:25 UTC
Revision at save: main at 4d92209 (macOS setup and workflow skills), matching cached origin/main. No remote refresh performed.
Uncommitted work: Feature 14 reporter implementation/tests/fixtures, direct dependency declarations, six context documents, and this handoff. The earlier macOS mock correction and skill changes are now committed in 4d92209. This handoff precedes the user-requested Feature 14 commit/push; check Git history/status for the resulting revision.

## Objective and current state

Build Shipcheck v0.1, a NestJS standalone release-readiness CLI for Node.js/TypeScript repositories using npm. Follow [AGENTS.md](AGENTS.md), including the ordered context reading on a new session.

**Features 01–11, 13 and 14 are implemented and verified. Next: Feature 12 Scan Orchestration.** The approved Phase 4 order is **13 → 14 → 12 → 15**, followed by 16–18. Feature 12 already has a detailed architecture plan, now updated to await the implemented reporter API. No unresolved product decision or blocker remains. This save does not authorize starting the next feature.

Scope remains help, version, scan and scan --ci; four sequential scanners (Git, Build, Tests, Environment). No HTTP server, database, frontend, configuration system, additional scanners/package managers/report formats, or public npm publication. Shipcheck-owned operations are read-only; repository-owned build/test scripts may have side effects. Never expose environment values, raw subprocess output, or error stacks in reports.

Plans and evidence: [build-plan.md](context/build-plan.md), [progress-tracker.md](context/progress-tracker.md), [scanner-registry.md](context/scanner-registry.md), [library-docs.md](context/library-docs.md). Local setup is complete on macOS / Node 24.21.0 / npm 11.19.0.

## Implemented boundaries

- Bootstrap runs once through CommandFactory, with shebang/reflect-metadata preserved. Help/version work independently of target cwd; the version comes from Shipcheck package metadata. Command/bootstrap layers own exits and safe fatal messages.
- **ScanService still only discovers the project and returns the temporary failed gate** as Pick<ScanReport, "gatePassed">. It does not execute scanners or render reports. Local/CI shell exits remain 0/1; usage/discovery/unexpected failures exit 2. Ambient CI does not select command mode.
- Discovery resolves process.cwd() once, reads only its package.json via FileSystem, selects string name/build/test fields, and uses the directory basename for missing/blank name. ProjectDiscoveryError carries safe text; causes stay private. Readonly context fields are compile-time protection, not deep freezing.
- Shared contracts define complete ScanResult/ScanReport, frozen SCAN_ORDER, 25-point weights and READY/REVIEW thresholds 90/70. SCANNERS is one shared symbol; ScannersModule exports an ordered factory of existing singleton scanners. ScanModule imports InfrastructureModule and ScannersModule only.
- ProcessRunner takes separate executable/arguments, shell:false, explicit cwd/timeouts, closed stdin, captured output and a copied environment. Check failure flags before numeric exits. Timeout returns timedOut:true/synthetic exit 1; start failures throw ProcessStartError; other adapter failures throw ProcessExecutionError. Capture uses buffer encoding with 1,000,000 bytes per stream before UTF-8 decoding. Limits: Git 10s per command; build/test 120s; termination grace 5s. FileSystem owns runtime project-file access/executable lookup; exists returns false only for ENOENT. Clock is monotonic.
- Git runs rev-parse, branch --show-current and status --porcelain. Non-repo/dirty → failed; clean → passed; later Git failures/timeouts → error. Output exposes branch/count only, never changed paths.
- Build/Test fail without spawning for missing/blank scripts. npm build/test: zero → passed; nonzero/timeout/output overflow → failed; start/other adapter failures → error. Tests set CI=true only in the subprocess. Raw output stays private.
- Environment uses dotenv.parse and accepts any trimmed non-empty value independently from .env, .env.local or an own process.env property. Missing example → skipped; empty contract → passed without optional reads; missing names → failed with full sorted names. Optional ENOENT is ignored; other file/parser failures → safe error. Values never enter results or mutate process.env.
- ScoringService.calculate(readonly ScanResult[]) returns score/status/gatePassed. It excludes skipped weights, includes failed/error weights without points, rounds once, and passes only READY. Empty/all-skipped → 0/NOT_READY/false. It does not mutate inputs or validate trusted internal result identity/weights. ScoringModule exports it but awaits Feature 12 wiring.

## Feature 14 — completed, uncommitted

Runtime files are under `src/reporter/`: TerminalReporter, ReporterModule, injection tokens, output tokens, output/capability types, and `write-output.ts`. Only TerminalReporter imports Chalk/Ora; no library-specific types leak into its public declarations.

- `startScanner(id, { ci }): void` clears previous progress and optionally starts one spinner.
- `stopScanner(): void` is idempotent; `onModuleDestroy()` invokes it for Nest cleanup.
- `report(report, { ci }): Promise<void>` clears progress, formats the supplied ordered report, awaits one stdout write and propagates failure. It never changes scores, inputs or exits.
- ReporterModule injects output, capabilities and version; exports only TerminalReporter; remains outside ScanModule until Feature 12. Construction is silent. The async version factory reuses readPackageVersion(). Tests override it; native probes exercise the real loader from an unrelated cwd.
- Production capabilities capture stdout.isTTY, presence of NO_COLOR, and test mode (VITEST=true or NODE_ENV=test). Color requires TTY, absent NO_COLOR and ci=false; animation also requires testMode=false. Tests inject capabilities and fake Ora rather than changing the developer's environment.
- Chalk 4.1.2 and Ora 5.4.1 were already locked transitively through nest-commander. They are now exact direct dependencies; no installed package versions, engine baseline or module settings changed. Both require Node >=10; native ESM default imports and NodeNext compilation passed. Use a private Chalk instance at level 0/1; never mutate the global instance.
- Ora defaults to stderr and can print text when isEnabled=false. Disabled progress skips construction entirely. Enabled progress uses explicit stdout, isEnabled:true, discardStdin:false and default frames/cursor management. Never use succeed/fail/persist helpers. Failed start is cleaned up; final report and module close stop progress.
- writeOutput waits for the stream callback, not its backpressure boolean. Node can emit error after calling a failed write callback: keep the listener through that turn, then remove it. Handle callback/event/throw failures without closing process streams. Reporting failure remains fatal, not a scanner result.

Formatting decisions are recorded in the output tokens/rules:

- Preserve supplied registry order and canonical ID-based display names. Literal row formula is symbol + space + name.padEnd(12) + space + summary; Environment has two spaces after its name.
- Preserve canonical summaries including lowercase npm/package.json; errors count with failures. Render supplied score/status/gate and display NOT_READY as NOT READY. Use canonical labels, section gaps and one final newline. Optional duration suffixes are omitted; data fields remain intact.
- Only failed Environment details are public: first five sorted missing names, then an extra `  - …and N more` indicator when needed. Each plain detail line is at most 160 Unicode code points including prefix and truncation ellipsis; never split surrogate pairs. Style afterward.
- Remove terminal escape sequences and replace remaining C0/C1 controls and Unicode line separators with spaces in display fields. Keep the full path and untruncated summary. This is display safety, not arbitrary-secret detection: scanners must still return safe summaries/names. Ignore disallowed details and extra object fields.

Tests: `test/unit/reporter/`, `test/integration/terminal-reporter.integration.spec.ts`, `test/helpers/reporter-fixture.ts`, `test/helpers/terminal-reporter-probe.ts`, and five committed-source text snapshots under `test/fixtures/reporter/`. Snapshot paths point outside generated .test-dist, so recompilation does not discard them.

## Next integration

Follow Feature 12's controlling plan in build-plan.md. Inject FileSystem, SCANNERS, Clock, ScoringService and TerminalReporter. Import ScoringModule/ReporterModule into ScanModule. Await scanners sequentially, preserve normal results, synthesize safe error results after unexpected scanner throws, score once, assemble a complete report, **await reporter.report()**, then return the same report object. Discovery/scoring/progress/reporting failures stay fatal. Commands select exits only after reporting finishes.

Update temporary shell tests/probes and documentation as part of Feature 12. Never run Shipcheck's own npm test through shipcheck scan: this would recurse once orchestration is active. Use controlled providers or isolated minimal projects. Feature 15 verifies real report/exit behavior; 16 owns representative full-pipeline fixtures; 17 owns installed-package smoke tests.

## Durable decisions and lessons

- Baseline: Node >=22.12, native ESM, strict TypeScript NodeNext, runtime .js relative imports, MIT/private package. Nest common/core/testing 11.2.5, TypeScript 5.9.3 and Vitest 5.0.1 are unchanged. Do not blindly upgrade Nest: nest-commander's discovery dependency required Nest 11 despite broader peers. Vitest supports Node ^22.12 or ^24 or >=26; use a supported contributor runtime.
- npm test builds dist and compiles tests with tsc into .test-dist before Vitest, preserving Nest constructor metadata. A consumer in an importing module proves export visibility; unrestricted moduleRef.get alone does not. Native probes must import runtime tokens/classes from the same dist tree.
- Keep native package-version probes: Vitest data-URL transforms previously dropped JSON import attributes. Do not weaken the production loader for that transform.
- nest-commander child commands need explicit strictness and throwing parser-exit overrides. Returning can permit premature process.exit(). Bootstrap applies parser exits after cleanup; cleanup failure can override success.
- With exactOptionalPropertyTypes, omit undefined unless included explicitly. Use optional chaining for possibly absent mock tuples under noUncheckedIndexedAccess. Narrow private Picks prevent Execa generics leaking into domain types. The ES2022 lib target lacks Promise.withResolvers typings even on Node 24; use a typed deferred Promise in tests instead of changing compiler settings.
- The approved Windows exception permits Execa's internal cmd.exe handling of resolved npm.cmd, retaining shell:false and separate file/args. Native .exe/.com and npm.cmd are supported; arbitrary shebang/batch launchers and metadata-denied aliases fail safely.
- Descendant cleanup is best-effort, not containment or a hard deadline. Windows taskkill restrictions previously left descendants/pipes alive. Use normal Windows process permissions and `NO_COLOR=1 npm test -- --maxWorkers=4`. Four workers reduce fixture contention; preserve the tree fixture's ten-second startup allowance and emergency cleanup.
- Windows executable lookup mocks must use a Windows path, not host process.execPath. The current fixed C:\tools\node.exe mock avoids macOS failures; Execa is mocked so it need not exist. This correction is committed in 4d92209.
- Git fixtures isolate global/system config, hooks, signing and branch defaults. Runtime scanner commands inherit normal context and stay read-only.
- Build/Test timeout and overflow intentionally mean failed; Git operational failures mean error. Unexpected non-process throws await Feature 12 isolation. Do not add real 120-second scanner tests: adapter timeout behavior already has native coverage.
- Keep scaffold forbidden-test-output checks anchored to dist root; dist/scanners/test is legitimate. Environment presence uses Object.hasOwn; dotenv.parse is permissive, without config(), interpolation or syntax validation. Its README options differ from installed declarations, so no parse options are used.
- PowerShell may strip node -e quoting; prefer checked-in helpers or literal stdin. ConvertFrom-Json cannot handle the lockfile's empty-key entry; inspect with rg. Inspect partial changes after tool failures and do not replay blindly or weaken Git ownership checks.

## Verification and limits

Feature 14, 2026-10-01, macOS / Node 24.21.0 / npm 11.19.0:

- Offline dependency declaration failed with missing Ora registry metadata (ENOTCACHED); an approved network/cache-enabled npm install succeeded with scripts disabled. Root direct declarations were the only lockfile changes.
- Production build and native ESM imports passed. Initial test compilation rejected test-only Promise.withResolvers; after replacing it, compilation passed.
- All **47 focused reporter checks** passed: five canonical snapshots, detail boundaries/overflow/Unicode, forbidden-field sentinels, control stripping, frozen inputs/order, capability/color policy, spinner lifecycle/failures, awaited writer errors/backpressure/listener cleanup, module visibility and native production probes.
- `NO_COLOR=1 npm test -- --maxWorkers=4` passed production/test compilation and **322 tests across 27 files**; test execution took 11.19 seconds.
- Manual native PTY probes verified local progress/style, clearing before reporting and on module close, plain CI and empty NO_COLOR, and 80-column output. Piped native integration probes checked separate stdout/stderr and real package version from unrelated cwd.
- Scoped review found no actionable findings. Scanner registry remains accurate. git diff --check passed. Subsequent changes were documentation/handoff only; tests were not rerun for this save.

Earlier evidence: Feature 13 passed 275 tests on Windows / Node 24.16.0. The macOS setup then passed the same 275 after the Windows-path mock correction; help/version were checked. Optional fsevents install scripts were not approved; builds/tests work without them, and watch mode was not verified. Earlier detailed evidence remains in progress-tracker.md.

Limits: Feature 14 is verified on macOS only. Minimum Node 22.12, Linux, and reporter behavior on Windows remain unverified. Full scan/report integration, report-before-command-exit checks, representative pipeline fixtures and installed packaging remain pending. No global npm link was installed. v0.1 is not complete.

## Next steps

1. Read the required context pack and compare Git status/history with this handoff; preserve the uncommitted Feature 14 work.
2. When requested, implement **Feature 12 Scan Orchestration** from its existing plan, using the completed scoring and reporter contracts. No new sequencing approval is needed.
3. Continue with Feature 15, then 16–18. Commit/push only when requested.
