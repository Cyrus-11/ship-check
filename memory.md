# Shipcheck project memory

Updated: 2026-09-30 08:17:31 UTC
Revision at save: main at feecb4c (README scoring milestone), matching cached origin/main; scoring implementation committed at fcd9c11. No remote refresh performed.
Remote: https://github.com/Cyrus-11/ship-check.git
Uncommitted work: macOS test-fixture correction in test/unit/infrastructure/process-runner.spec.ts, setup evidence in context/progress-tracker.md, and this handoff. Pre-existing changes affect four .agents/skills/*/SKILL.md files and skills-lock.json, with untracked frontend.md references under architect, recover, and review. Preserve those unrelated changes. No commit or push was requested in this session.

## Objective and current state

Build Shipcheck v0.1, a NestJS standalone release-readiness CLI for Node.js/TypeScript repositories using npm. Follow [AGENTS.md](AGENTS.md), including its ordered context reading on a new session.

**Features 01–11 and 13 are implemented and verified. Next: Feature 14 Terminal Reporter.** On 2026-09-28 the user approved Phase 4 order **13 → 14 → 12 → 15**, because orchestration requires scoring and reporter providers. Feature 12 is architected but awaits Feature 14. No unresolved decision or blocker remains. This save does not authorize implementation of the next feature.

Scope: help, version, scan, scan --ci; four sequential scanners (Git, Build, Tests, Environment). No HTTP server, database, frontend, configuration system, extra scanners, other package managers, or public npm publication. Shipcheck-owned operations are read-only; repository-owned build/test scripts can have side effects. Never expose environment values, raw subprocess output, or error stacks in reports.

Detailed plans and evidence: [build-plan.md](context/build-plan.md), [progress-tracker.md](context/progress-tracker.md), [scanner-registry.md](context/scanner-registry.md), [library-docs.md](context/library-docs.md).

The user requested local setup before architecting Feature 14. This is now complete on macOS with Node 24.21.0 / npm 11.19.0: locked dependencies installed, production/test builds and all 275 tests passed, compiled help/version checked. Feature 14 has not started; Chalk/Ora remain deferred to that feature. No dependency versions or production behavior changed.

## Implemented boundaries

- Bootstrap runs once through CommandFactory; main preserves the shebang and reflect-metadata import. Help/version work independently of target cwd; version comes from package metadata.
- ScanService currently discovers the project then returns the temporary failed gate as Pick<ScanReport, "gatePassed">. It does not run scanners or print reports yet. Local/CI shell exits are 0/1; usage, discovery, and unexpected failures exit 2. Ambient CI does not select CLI mode.
- Discovery resolves process.cwd() once, reads only its package.json via FileSystem, validates/narrows name and build/test scripts, and falls back to directory basename for missing/blank name. ProjectDiscoveryError carries canonical safe text; internal causes stay private. Context/package readonly fields are compile-time protection, not runtime deep freezing.
- Common contracts define complete ScanResult/ScanReport, frozen SCAN_ORDER, 25 points per scanner, and READY/REVIEW thresholds 90/70.
- ProcessRunner receives separate executable/arguments, shell:false, explicit cwd/timeouts, closed stdin, captured output, and a copied environment with overrides. Timeout returns timedOut:true and synthetic exit 1; start failures throw ProcessStartError; other operational failures throw ProcessExecutionError. Check failure flags before numeric exits.
- Capture uses encoding:buffer and 1,000,000 bytes per stream before UTF-8 decoding. Limits: Git 10 seconds per command, build/test 120 seconds, termination grace 5 seconds. FileSystem owns runtime filesystem access and executable lookup; exists returns false only for ENOENT. Clock is monotonic.
- Git scanner runs rev-parse, branch --show-current, and status --porcelain. Non-repo → failed; dirty → failed; clean → passed. Later Git failures/timeouts → error. Reports branch/count only, no changed paths.
- Build/Test scanners fail for missing/blank scripts without spawning. Repository-owned npm run build / npm test: zero → passed; non-zero, timeout, or output-limit overflow → failed; start/other adapter failures → error. Test sets CI=true only in the child environment. No raw output enters results.
- Environment scanner uses dotenv.parse on .env.example and accepts a trimmed non-empty value independently from .env, .env.local, or an own process.env property. Missing example → skipped; empty contract → passed without optional reads; missing names → failed with full sorted names. Optional ENOENT is ignored, other file/parser failures → safe error. Values never enter reports or mutate process.env. Reporter owns display limits.
- Feature 11: shared SCANNERS symbol in src/scanners/scanner.tokens.ts; ScannersModule exports an explicit ordered factory of the existing scanner singletons. ScanModule imports ScannersModule and InfrastructureModule. No execution or discovery occurs in the registry factory.
- **Feature 13:** src/scoring/scoring.service.ts provides calculate(readonly ScanResult[]): Pick<ScanReport, "score" | "status" | "gatePassed">. It uses result weights, excludes skipped weights, includes failed/error weights without points, rounds the final percentage once, maps shared thresholds, and passes only READY. Empty/all-skipped input → 0 / NOT_READY / false. It returns a fresh object without mutation or retained state.
- src/scoring/scoring.module.ts exports ScoringService. It intentionally remains outside ScanModule until Feature 12. No runtime validation/clamping of internal weights, duplicate IDs, or incomplete result collections was added; registry/orchestration own result integrity. No dependency changes.

## Planned integration

Feature 12's controlling plan is in build-plan.md. It injects FileSystem, SCANNERS, Clock, ScoringService, and TerminalReporter; awaits scanners sequentially; preserves normal results; synthesizes a safe error result after an unexpected scanner throw; scores once; assembles/renders/returns one complete report. Discovery/scoring/reporter failures remain fatal rather than scanner results. Commands own exit selection.

Feature 14 must first architect/implement the reporter contract: startScanner(id, { ci }), stopScanner(), report(report, { ci }), exported through ReporterModule. It owns writer/capability abstractions, Chalk/Ora, safe detail limits, CI/non-TTY/NO_COLOR behavior, and canonical output tokens/rules. Chalk/Ora are approved but not installed yet; inspect versions, compatibility, and documentation when introducing them.

Avoid recursive CLI tests: never run Shipcheck's own npm test through shipcheck scan. Use controlled providers or isolated minimal projects. Feature 16 owns representative full-pipeline fixtures; Feature 17 owns installed-package smoke tests.

## Durable decisions and lessons

- Baseline: Node >=22.12, native ESM, strict TypeScript NodeNext, runtime .js relative imports, MIT/private package. Verified on Windows / Node 24.16.0 and macOS / Node 24.21.0. Pinned versions are in package.json and lockfile; Nest common/core/testing 11.2.5, TypeScript 5.9.3, Vitest 5.0.1 remain unchanged. Do not blindly upgrade Nest: nest-commander's discovery dependency required Nest 11 despite broader advertised peers.
- npm test builds production and compiles tests with tsc before Vitest runs .test-dist/test/**/*.spec.js. This preserves Nest constructor metadata. A consumer in an importing module proves provider export visibility; unrestricted moduleRef.get alone does not. Native probes must import symbols/providers from the same dist tree.
- nest-commander child commands need explicit strictness/throwing exit overrides. Returning from the parser override can allow premature exit. Bootstrap applies process.exitCode after cleanup; cleanup failure can override success.
- Keep native subprocess coverage for the package-version loader: Vitest data-URL transforms dropped JSON import attributes. Do not weaken production code for that transform.
- Under exactOptionalPropertyTypes, optional script fields must omit undefined unless explicitly part of the contract. Use optional chaining for potentially absent mock-call tuples under noUncheckedIndexedAccess. A narrow private Pick avoids exposing Execa generics in domain types.
- The user approved Execa's internal cmd.exe launcher for resolved npm.cmd while retaining shell:false and prohibiting Shipcheck-built shell strings. Windows supports native .exe/.com and npm.cmd; arbitrary batch/shebang launchers and metadata-denied aliases fail safely.
- Process-tree cleanup is best-effort, not containment or a hard deadline. Windows sandbox taskkill restrictions previously left descendants/pipes alive. Run the full suite with normal Windows process permissions and NO_COLOR=1, using npm test -- --maxWorkers=4. Four workers reduce existing npm fixture contention. The tree fixture uses a ten-second startup allowance and independent emergency cleanup; do not reduce it to the former flaky two seconds.
- Git fixtures isolate global/system config, hooks, signing, and branch defaults. Runtime scanner commands remain read-only and inherit normal context.
- Windows simulations must mock executable lookup with a Windows path, not the host process.execPath. The latter lacks .exe on macOS and correctly fails the production Windows executable allowlist. The ProcessRunner unit setup now returns a fixed C:\tools\node.exe path; Execa remains mocked, so this path need not exist.
- Build/Test timeout and output overflow intentionally map to failed; Git operational failures map to error. Unexpected non-process throws are left for Feature 12 isolation. Real 120-second scanner timeout tests are unnecessary: mapping is unit-tested and adapter timeout has real coverage.
- Keep the scaffold test's forbidden test-output match anchored to the dist root; dist/scanners/test is legitimate.
- Environment presence must use Object.hasOwn for process.env (e.g. toString must not count as a value). dotenv parsing is permissive, without config(), interpolation, or syntax validation. Native named ESM import was verified. Its README debug option differs from installed declarations; no parse options are used.
- PowerShell can strip node -e quotes; prefer literal stdin or a checked-in helper. Windows PowerShell ConvertFrom-Json cannot parse the lockfile's empty-key entry; rg can inspect locked package versions directly. Sandbox setup helpers occasionally fail with access denied: inspect partial results before retrying, use short commands, and request normal permissions when needed. Never blindly replay edits or weaken Git ownership checks.

## Verification

Local setup, 2026-09-30:
- Initial npm ci failed with sandbox DNS access denied (ENOTFOUND registry.npmjs.org); the approved network-enabled retry installed 153 packages from the existing lockfile and reported zero vulnerabilities.
- npm reported an unapproved optional fsevents install script. It was not approved; the current build/test workflow passes without it. Watch mode was not checked.
- First suite: 274/275 passed. Diagnosed the host-dependent Windows lookup mock and corrected only that test fixture.
- NO_COLOR=1 npm test -- --maxWorkers=4 then passed production/test compilation and **275 tests across 23 files** on macOS / Node 24.21.0; test execution took 11.28 seconds.
- node dist/main.js --help and --version passed; version output was 0.1.0. git diff --check passed after the test/tracker updates. Scanner implementation and registry status are unchanged.

Feature 13, 2026-09-28:
- npm run build and npm run test:compile passed.
- 23 focused scoring tests passed in test/unit/scoring/scoring.service.spec.ts.
- NO_COLOR=1 npm test -- --maxWorkers=4 passed **275 tests across 23 files** (252 prior + 23 new), including compilation; test execution took 90.39 seconds.
- Coverage: canonical outcomes, error/skip weights, zero denominator, exact thresholds, rounding before classification, fractional aggregation, frozen inputs/order independence, fresh projections, no score retention, and constructor injection of the module export.
- Scoped review covered plan alignment, provider boundaries, trusted internal inputs, policy correctness, and regression coverage; no actionable findings. Scanner registry remains accurate. git diff --check passed.
- No runtime code changed after the passing suite; subsequent edits are documentation/handoff only. No extra user-visible CLI smoke test was needed for this isolated provider.
- Earlier feature-specific test evidence and review dispositions remain in progress-tracker.md rather than repeated here.

Limits: Existing suite verified on Windows and macOS with the Node 24 versions above. Minimum Node 22.12 and Linux remain unverified. Full pipeline/report behavior, representative full-scan fixtures, and installed packaging remain pending. No global npm link was installed. v0.1 is not complete.

## Next steps

1. Restore Git status/history and read the required context pack.
2. Local setup is complete. Architect **Feature 14 Terminal Reporter** against output tokens/rules and the Feature 12 collaborator contract when requested; inspect Chalk/Ora versions, compatibility, and documentation before introducing them.
3. Implement/verify 14, then 12 and 15, followed by 16–18. The approved order does not require another sequencing decision.

Available commands: npm run build, npm test, npm run dev, and node dist/main.js with --help, --version, scan --help, scan, or scan --ci. Dev watches/recompiles only.
