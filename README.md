# Shipcheck

Shipcheck is a local-first release-readiness CLI for Node.js and TypeScript repositories using npm. The planned v0.1 scan checks Git state, build, tests, and required environment-variable names, then reports a readiness score and release decision.

## Current status

**Features 01–05 are complete.** The CLI foundation, shared domain contracts, and infrastructure adapters are implemented and tested. The release-readiness pipeline is still under development.

The scan shell performs no checks or project discovery and prints no report yet. Its temporary result always has a failed release gate, so `scan` exits `0` and `scan --ci` exits `1`. These are development placeholders, not readiness assessments. Scanners, scoring, and reporting remain unfinished. Only the boolean `--ci` option is accepted; custom paths and flag values are unsupported.

| Completed area | What is available |
| --- | --- |
| CLI foundation (01–03) | TypeScript/native ESM setup, NestJS standalone bootstrap, help/version, strict option parsing, scan command shell, and application cleanup |
| Domain contracts (04) | Shared scanner/context/report types, fixed scanner order, 25-point weights, and readiness thresholds |
| Infrastructure adapters (05) | Process execution with timeouts, bounded output and operational errors; read-only filesystem access; monotonic timing; injectable providers |

**Next: Feature 06 — Project Discovery and Scan Context.** Scanner implementations, orchestration, scoring, reporting, and executable packaging verification follow. See the [progress tracker](context/progress-tracker.md) and [build plan](context/build-plan.md).

## Current commands

After building, run the compiled entry point:

| Command | Current behavior | Exit code |
| --- | --- | --- |
| `node dist/main.js --help` | Show CLI help | `0` |
| `node dist/main.js --version` | Show the version from package metadata | `0` |
| `node dist/main.js scan --help` | Show scan options | `0` |
| `node dist/main.js scan` | Run the empty development shell; no checks or report | `0` |
| `node dist/main.js scan --ci` | Run the same shell with its temporary failed gate | `1` |

Invalid commands, unsupported options, and positional project paths exit `2`. Help/version finish application cleanup before exiting.

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

`npm run dev` watches and recompiles application source. Run the compiled entry point separately after a successful build.

`npm test` first builds production code and compiles the tests with `tsc`, then runs Vitest against `.test-dist/`. This preserves Nest constructor metadata in both builds. Production output in `dist/` contains no tests.

The suite covers CLI help/version, strict usage, local/CI option forwarding and exits, asynchronous cleanup, safe errors, domain contracts, and dependency injection. Adapter tests cover real subprocess output/exits, timeouts, byte limits, environment preservation, filesystem reads, and npm execution from paths containing spaces. Native subprocess probes verify production modules and preserve JSON import attributes in metadata-loader tests.

**Last verified:** production/test compilation and **139 tests across 11 files passed** on Windows with Node 24.16.0 and `NO_COLOR=1` (2026-09-21). Minimum Node 22.12, other operating systems, and installed Shipcheck packaging remain unverified.

On Windows, the process adapter supports native `.exe`/`.com` commands and the installed `npm.cmd` launcher. Shipcheck passes executable and arguments separately with `shell: false`; Execa handles npm's internal Windows shell launcher. The process-tree tests need permission to run Windows `taskkill`. Restricted sandboxes can prevent descendant cleanup; termination is best-effort and may exceed the configured timeout. See [library notes](context/library-docs.md) for details and supported-launcher limitations.

## Scope and trust

v0.1 will expose help, version, `scan`, and `scan --ci`, with exactly four sequential scanners: Git, Build, Tests, Environment. It uses in-memory state and has no HTTP server, database, or account requirement.

Shipcheck-owned operations are read-only. Once scanning is implemented, project build/test scripts will execute repository-owned code and may generate files or perform other side effects. Scanning is not a sandbox; use trusted repositories.

Public npm publication is outside the current implementation scope. The package is marked private while local executable packaging is developed.

## License

[MIT](LICENSE).
