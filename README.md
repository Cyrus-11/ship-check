# Shipcheck

Shipcheck v0.1 is a local-first release-readiness CLI for Node.js and TypeScript repositories using npm. It checks Git, build, tests, and required environment-variable names, then reports a score and release decision.

## Installation

Requires Node.js 22.12+, npm and Git on PATH. Install the target project's dependencies before scanning. Shipcheck is private and has not been published to npm; install from a checkout or its local tarball.

From the Shipcheck checkout:

```sh
npm ci
npm run build
npm pack --dry-run
npm pack
```

The tarball is `shipcheck-0.1.0.tgz`. To install it in a separate tools directory with its own `package.json` (replace the absolute path with your checkout):

```sh
npm install --ignore-scripts --no-audit --no-fund /absolute/path/to/ship-check/shipcheck-0.1.0.tgz
```

Add that tools directory's `node_modules/.bin` to PATH. On POSIX shells:

```sh
export PATH="/absolute/path/to/tools/node_modules/.bin:$PATH"
```

On PowerShell:

```powershell
$env:Path = "C:\absolute\path\to\tools\node_modules\.bin;$env:Path"
```

Installing in a separate directory avoids adding Shipcheck to the scanned project's manifest. Runtime dependencies may require npm registry access during installation. Tarball installation follows [npm's local-package installation rules](https://docs.npmjs.com/cli/v11/commands/npm-install/).

### Local development link

After installing dependencies and building in the checkout, create a link under a dedicated, writable npm prefix (replace the example path):

On POSIX shells:

```sh
NPM_CONFIG_PREFIX=/absolute/path/to/local-prefix npm link --ignore-scripts --no-audit --no-fund
```

On PowerShell, set the prefix for the link command and then remove the override:

```powershell
$env:NPM_CONFIG_PREFIX = 'C:\absolute\path\to\local-prefix'
npm link --ignore-scripts --no-audit --no-fund
Remove-Item Env:NPM_CONFIG_PREFIX
```

Add `/absolute/path/to/local-prefix/bin` to PATH on POSIX. On Windows, add the prefix directory itself to PATH, where npm places `shipcheck.cmd`. The link points at the checkout; rebuild after source changes. This uses [npm's prefix and executable linking behavior](https://docs.npmjs.com/cli/v11/commands/npm-link/) without needing a second link inside the scanned project.

## Usage

Run these commands from the root of a trusted target project, where `package.json` is located:

```sh
shipcheck --help
shipcheck --version
shipcheck scan
shipcheck scan --ci
```

Help and version also work outside a project. `shipcheck scan --help` shows scan help. Discovery reads only `<cwd>/package.json`; it does not search parent directories. Custom paths, option values such as `--ci=true`, and configuration files are unsupported. Ambient `CI` does not enable gate enforcement; pass `--ci` explicitly.

**Trust:** Shipcheck-owned operations do not modify the scanned repository. Build and test scripts execute repository-owned code and may generate files or perform other side effects. Scanning is not a sandbox; use trusted repositories.

## Checks and scoring

Scanners run sequentially in this fixed order. A failed check or unexpected scanner error does not prevent later scanners from running.

| Scanner | Release condition |
| --- | --- |
| Git | Inside a Git work tree with no staged, unstaged or untracked changes. A detached HEAD alone does not fail. Only branch and changed-file count are reported. |
| Build | A non-empty `scripts.build` exists and `npm run build` exits 0. |
| Tests | A non-empty `scripts.test` exists and `npm test` exits 0. The child receives `CI=true`; the parent environment is unchanged. No framework-specific flags are added. |
| Environment | Every name parsed from `.env.example` has a non-whitespace value in the process environment, `.env` or `.env.local`. Presence in any source is sufficient. No example file skips this check; an empty example passes. |

Each scanner carries 25 points. Passed checks earn their weight; failed checks and operational errors earn zero. Skipped checks are excluded from the denominator. The percentage is rounded once to the nearest integer. Three passes and one failure score 75; three passes and one skipped check score 100.

| Score | Displayed status | Release gate |
| --- | --- | --- |
| 90–100 | `READY` | PASSED |
| 70–89 | `REVIEW` | FAILED |
| 0–69 | `NOT READY` | FAILED |

Missing build/test scripts fail. Build/test nonzero exits, timeouts and output-limit failures fail; unavailable executables and unexpected adapter failures are operational errors. Git has a 10-second timeout; build and tests each have 120 seconds. Process termination is best-effort and is not a hard wall-clock deadline.

Environment validation checks presence only, not credential validity or production suitability. Values, raw subprocess output and error stacks are never included in reports. Missing names are sorted; the reporter shows up to five, with an overflow count for the rest.

## Example report

This plain report matches the canonical REVIEW snapshot:

```text
Shipcheck v0.1.0

Project: example-service
Path: /workspace/example-service

✓ Git          Working tree is clean (main)
✓ Build        npm run build passed
✓ Tests        npm test passed
✗ Environment  Missing 2 required variables
  - DATABASE_URL
  - REDIS_URL

Checks: 3 passed, 1 failed, 0 skipped
Release score: 75/100
Status: REVIEW
Release gate: FAILED
```

Completed reports go to stdout. Fatal errors go to stderr. Local interactive terminals show progress and color; `--ci`, non-TTY output and `NO_COLOR` disable both. Terminal text is sanitized; missing-name detail lines are limited to 160 Unicode code points.

## Exit codes

| Outcome | Local scan | `scan --ci` |
| --- | --- | --- |
| Completed, READY | 0 | 0 |
| Completed, REVIEW or NOT READY (including scanner errors) | 0 | 1 |
| Invalid usage, project discovery, bootstrap, report or cleanup failure | 2 | 2 |

Help/version exit 0. Local completion does not mean the release gate passed; read the report. A missing, unreadable or invalid `package.json` prevents a scan report and exits 2. Output and application cleanup finish before normal command exit.

## v0.1 limitations

Only help, version, `scan` and `scan --ci` are supported. There are no custom scanner selections, parallel scans, extra package managers or languages, lint/coverage/security checks, configuration files, additional report formats, automatic fixes, plugins, accounts, telemetry or remote services. Public npm publication is outside this implementation scope.

The v0.1 release candidate is verified on macOS with Node 24.21.0 / npm 11.19.0. Earlier features were tested on Windows with Node 24.16.0; final Windows reporting, orchestration, fixtures and installed packaging, Linux, and minimum Node 22.12 remain unverified. These are verification limits, not evidence of cross-platform success.

## Development and verification

From the checkout root, use Node 22.12+ on the 22.x line or Node 24.x, supported by the pinned Vitest release:

```sh
npm ci
npm run build
node dist/main.js --help
node dist/main.js --version
node dist/main.js scan --help
npm test -- --maxWorkers=4
```

`npm run dev` watches and recompiles source; invoke the compiled entry point separately. Do not scan Shipcheck's checkout as a test: its test script would run the suite recursively. Use isolated target projects.

`npm test` builds production code and compiles tests with `tsc` before Vitest runs `.test-dist`, preserving Nest constructor metadata. The 376-test suite covers providers, adapters, scanners, scoring, canonical reporter snapshots, lifecycle/error/exit behavior, and 16 full-pipeline fixture cases. Fixtures use real Git/npm in temporary copies, assert exact safe reports and exits, and check original files and Git state while allowing only expected build/test artifacts. No fixture scripts run in source directories.

For plain test output, set `NO_COLOR=1` (PowerShell: `$env:NO_COLOR = '1'`; POSIX: `NO_COLOR=1 npm test -- --maxWorkers=4`). See the [progress tracker](context/progress-tracker.md) and [build plan](context/build-plan.md) in the source checkout for verification evidence and release criteria; project context is excluded from the tarball.

## Installed-package smoke check

From the checkout root, with development dependencies installed:

```bash
npm run test:package -- --prepare
```

This dedicated check compiles its helper, cleans and rebuilds `dist`, checks `npm pack --dry-run`, creates a real tarball and installs it in an owned temporary consumer. `--prepare` permits registry access to fill a fresh temporary npm cache with runtime dependencies. It then removes that installation and verifies a clean `npm ci --offline`. Dependency lifecycle scripts, audit and funding requests are disabled. The ordinary `npm test` suite does not run this preparation or require registry access.

To run entirely offline using an already complete npm cache, supply its absolute path:

```bash
npm run test:package -- --cache /absolute/path/to/prepared/npm-cache
```

The cache is copied into the temporary workspace; an incomplete cache fails the check rather than skipping installation. Both modes invoke the installed `shipcheck` executable from directories outside the checkout for help/version, READY and failed-build local/CI scans, and fatal usage/discovery errors. They check exact reports/exits and fixture contents, permit only the scripts' expected generated files, and remove their temporary workspace afterward. No global installation, link or publication occurs. Run this check separately from other builds/tests because it rebuilds `dist`.

Distribution contains production `.js` files, package metadata, README and license; declarations, source maps, tests and project context are excluded. Keep `private: true`; local tarball installation works without publishing.

On Windows, the process adapter supports native `.exe`/`.com` commands and the installed `npm.cmd` launcher. Shipcheck passes executable and arguments separately with `shell: false`; Execa handles npm's internal Windows shell launcher. The process-tree tests need permission to run Windows `taskkill`. Restricted sandboxes can prevent descendant cleanup; termination is best-effort and may exceed the configured timeout. See [library notes](context/library-docs.md) for details and supported-launcher limitations.

## License

[MIT](LICENSE).
