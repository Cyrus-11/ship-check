# Shipcheck

Shipcheck is a local-first release-readiness CLI for Node.js and TypeScript repositories using npm. A scan checks Git state, build, tests, and required environment-variable names, then reports a readiness score and release decision.

## Current status

**Features 01–16 are complete.** The CLI foundation, shared domain contracts, infrastructure adapters, project discovery, all four scanners, their ordered registry, scan orchestration, readiness scoring, terminal reporter, CI exit verification, and full-pipeline fixtures are implemented and tested. v0.1 is not yet complete: packaging checks and release-candidate documentation remain.

The `scan` command discovers the target project by reading `<cwd>/package.json` without searching parent directories. It then runs the four scanners one at a time in Git → Build → Tests → Environment order, scores the results, and prints one report to stdout. A scanner that fails or throws unexpectedly is recorded as a result and the remaining scanners still run. A completed local scan exits `0`; `scan --ci` exits `0` only when the release gate passes and `1` otherwise. A missing, unreadable, or invalid `package.json` exits `2`. Only the boolean `--ci` option is accepted; custom paths and flag values are unsupported.

| Completed area | What is available |
| --- | --- |
| CLI foundation (01–03) | TypeScript/native ESM setup, NestJS standalone bootstrap, help/version, strict option parsing, the scan command, and application cleanup |
| Domain contracts (04) | Shared scanner/context/report types, fixed scanner order, 25-point weights, and readiness thresholds |
| Infrastructure adapters (05) | Process execution with timeouts, bounded output and operational errors; read-only filesystem access; monotonic timing; injectable providers |
| Project discovery (06) | Resolves the working directory once, validates `<cwd>/package.json`, narrows it to a supported subset with a directory-name fallback, and builds the scan context; discovery failures exit `2` with safe messages |
| Git scanner (07) | Read-only `git rev-parse`/`branch`/`status` checks that classify a clean, dirty, or non-repository work tree with a branch name and changed-file count only — no file paths are reported |
| Build scanner (08) | Evaluates `npm run build`; missing scripts, non-zero exits, timeouts, and output-limit failures fail the check; operational errors are reported separately |
| Test scanner (09) | Evaluates `npm test` with `CI=true` in the child environment, preserving the parent environment and using the same failure policy as Build |
| Environment scanner (10) | Parses required names from `.env.example`, checks for non-empty values across `.env`, `.env.local`, and the process environment, and returns missing names only; a missing example skips the check |
| Scanner registry (11) | Exports the four scanner instances in fixed Git → Build → Tests → Environment order |
| Scan orchestration (12) | Runs the registry sequentially, turns an unexpected scanner throw into a safe `error` result, scores once, awaits the report, and returns it to the command |
| Scoring service (13) | Calculates the readiness score, status, and release-gate decision from completed results; excludes skipped checks and uses the shared thresholds |
| Terminal reporter (14) | Prints the report with canonical symbols and labels, shows local progress in interactive terminals, and disables color/animation in CI, non-TTY output, and with `NO_COLOR` |
| CI exit enforcement (15) | Verifies complete reports and local/CI gate exits, safe fatal failures, cleanup and command ownership of exit decisions |
| Integration fixtures (16) | Exercises the real compiled CLI with seven isolated project families, exact reports/exits and explicit build/test artifact checks |

**Next: Feature 17 — Executable and Package Smoke Test.** Release-candidate documentation follows. See the [progress tracker](context/progress-tracker.md) and [build plan](context/build-plan.md).

## Readiness scoring

The implemented scoring service assigns points from scanner results. Each of the four scanners carries 25 points. Passed checks earn their weight; failed checks and operational errors earn zero. Skipped checks are excluded from the total applicable weight. The final percentage is rounded once to the nearest integer.

| Score | Status | Release gate |
| --- | --- | --- |
| 90–100 | `READY` | Pass |
| 70–89 | `REVIEW` | Fail |
| 0–69 | `NOT_READY` | Fail |

For example, three passes and one failure produce `75 / REVIEW`, while three passes and one skipped check produce `100 / READY`. Empty or entirely skipped results produce `0 / NOT_READY`. The report displays `NOT_READY` as `NOT READY`.

## Current commands

After building, run the compiled entry point:

| Command | Current behavior | Exit code |
| --- | --- | --- |
| `node dist/main.js --help` | Show CLI help | `0` |
| `node dist/main.js --version` | Show the version from package metadata | `0` |
| `node dist/main.js scan --help` | Show scan options | `0` |
| `node dist/main.js scan` | Scan the current project and print the readiness report | `0` |
| `node dist/main.js scan --ci` | Same scan without color or progress; enforces the release gate | `0` if the gate passes, otherwise `1` |

Invalid commands, unsupported options, and positional project paths exit `2`, as do project-discovery failures (a missing, unreadable, or invalid `package.json`). Help/version finish application cleanup before exiting.

## Development

The runtime baseline is Node.js 22.12+. For development and tests, use Node 22.12+ on the 22.x line or Node 24.x with npm; these versions satisfy the selected Vitest release's engine range.

```sh
npm ci
npm run build
node dist/main.js --help
node dist/main.js --version
node dist/main.js scan --help
npm test
```

For the full suite with reduced subprocess contention, use `npm test -- --maxWorkers=4`. The latest verification also set `NO_COLOR=1` (PowerShell: `$env:NO_COLOR = '1'`; POSIX shells: `NO_COLOR=1 npm test -- --maxWorkers=4`).

`npm run dev` watches and recompiles application source. Run the compiled entry point separately after a successful build.

`npm test` first builds production code and compiles the tests with `tsc`, then runs Vitest against `.test-dist/`. This preserves Nest constructor metadata in both builds. Production output in `dist/` contains no tests.

The suite covers CLI help/version, strict usage, local/CI option forwarding and exits, asynchronous cleanup, safe errors, domain contracts, and dependency injection. Adapter tests cover real subprocess output/exits, timeouts, byte limits, environment preservation, filesystem reads, and npm execution from paths containing spaces. Native subprocess probes verify production modules and preserve JSON import attributes in metadata-loader tests.

Project discovery and all four scanners have unit and integration coverage using isolated temporary projects. Registry tests verify order, weights, singleton identity, and provider exports. The scoring service adds 23 checks for result combinations, skipped/error weights, threshold and rounding boundaries, immutable inputs, independent calculations, and module export injection. Reporter tests compare canonical text snapshots and cover detail limits, control-character stripping, color/progress policy, and awaited writes. Orchestration tests cover sequential execution, throw isolation, scoring/reporting order, and fatal failures. They also run the compiled CLI against a minimal temporary project. No test scans Shipcheck's own repository, which would run its test suite recursively.

The full-pipeline fixture suite runs real Git/npm commands on fresh temporary copies of seven project families in both local and CI modes. It covers ready, dirty Git, failing build/test, missing environment, skipped environment and missing/malformed manifests, checks exact reports and exits, and permits only the expected repository-owned build/test artifacts. The fixtures have no dependencies or network operations.

**Last verified:** production/test compilation and **376 tests across 30 files passed** on macOS with Node 24.21.0 (2026-10-03). Earlier features were also verified on Windows with Node 24.16.0. Minimum Node 22.12, Linux, the reporter/orchestration/fixture suite on Windows, and installed Shipcheck packaging remain unverified.

On Windows, the process adapter supports native `.exe`/`.com` commands and the installed `npm.cmd` launcher. Shipcheck passes executable and arguments separately with `shell: false`; Execa handles npm's internal Windows shell launcher. The process-tree tests need permission to run Windows `taskkill`. Restricted sandboxes can prevent descendant cleanup; termination is best-effort and may exceed the configured timeout. See [library notes](context/library-docs.md) for details and supported-launcher limitations.

## Scope and trust

v0.1 will expose help, version, `scan`, and `scan --ci`, with exactly four sequential scanners: Git, Build, Tests, Environment. It uses in-memory state and has no HTTP server, database, or account requirement.

Shipcheck-owned operations are read-only. A scan runs the project's own build and test scripts, which execute repository-owned code and may generate files or perform other side effects. Scanning is not a sandbox; use trusted repositories.

Public npm publication is outside the current implementation scope. The package is marked private while local executable packaging is developed.

## License

[MIT](LICENSE).
