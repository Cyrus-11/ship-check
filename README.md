# Shipcheck

Shipcheck is a local-first release-readiness CLI for Node.js and TypeScript repositories using npm. The planned v0.1 scan checks Git state, build, tests, and required environment-variable names, then reports a readiness score and release decision.

## Current status

Features 01–03 provide the TypeScript and NestJS standalone CLI bootstrap and scan command shell. The compiled entry point supports product `--help`, package-derived `--version`, `scan`, and `scan --ci`. Invalid usage exits `2`; help and version exit `0` after application cleanup. See [the progress tracker](context/progress-tracker.md).

The scan shell performs no checks or project discovery and prints no report yet. Its temporary result always has a failed release gate, so `scan` exits `0` and `scan --ci` exits `1`. These are development placeholders, not readiness assessments. Scanners, scoring, and reporting remain unfinished. Only the boolean `--ci` option is accepted; custom paths and flag values are unsupported.

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

`npm test` first builds production code and compiles the tests with `tsc`, then runs Vitest against `.test-dist/`. This preserves Nest constructor metadata in both builds. Tests verify package metadata, root/scan help, version, strict usage errors, local/CI option forwarding and exit selection, asynchronous cleanup, safe startup/execution failures, absence of network listeners, and dependency injection. Metadata-loader tests run in native Node subprocesses to preserve JSON import attributes. Production output in `dist/` contains no tests.

## Scope and trust

v0.1 will expose help, version, `scan`, and `scan --ci`, with exactly four sequential scanners: Git, Build, Tests, Environment. It uses in-memory state and has no HTTP server, database, or account requirement.

Shipcheck-owned operations are read-only. Once scanning is implemented, project build/test scripts will execute repository-owned code and may generate files or perform other side effects. Scanning is not a sandbox; use trusted repositories.

Public npm publication is outside the current implementation scope. The package is marked private while local executable packaging is developed.

## License

[MIT](LICENSE).
