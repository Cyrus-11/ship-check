# Project Overview

## About the Project

Shipcheck is a local-first release-readiness CLI for Node.js and TypeScript repositories. A developer runs one command from the root of a project:

```bash
shipcheck scan
```

Shipcheck inspects the repository, runs the project build and test commands, validates required environment-variable names, and converts the results into a consistent release score and status.

Shipcheck v0.1 is intentionally small. It proves the command architecture, scanner contract, dependency injection, process execution, deterministic terminal reporting, automated testing, and CI-friendly exit behavior before any broader platform support is added.

---

## The Problem It Solves

Before releasing a backend project, developers repeatedly perform the same checks: inspect Git state, run the build, run tests, and confirm that required environment variables exist. These steps are easy to forget, they are reported differently across projects, and they are often only discovered after a deployment has already failed.

Shipcheck gives those checks one entry point and one release decision. It does not replace the project's build system or test framework. It orchestrates the commands the project already owns, normalizes their outcomes, and makes the result useful both locally and in CI.

---

## Product Boundary

Shipcheck v0.1 is:

- A NestJS standalone CLI application
- A release-readiness orchestrator for Node.js and TypeScript projects
- Read-only in its own operations on the scanned repository
- Local-first and usable without an account, network service, or database
- Human-readable by default and CI-aware when `--ci` is supplied

Build and test scripts execute repository-owned code and may generate files or perform other side effects. Scanning is not a sandbox; run Shipcheck only in repositories you trust.

Shipcheck v0.1 is not:

- A web application or REST API
- A deployment platform
- A replacement for Git, npm, a compiler, or a test runner
- A vulnerability scanner
- A general-purpose task runner
- A multi-language release platform

---

## Command Surface

Only the following public commands and flags exist in v0.1:

```bash
shipcheck --help
shipcheck --version
shipcheck scan
shipcheck scan --ci
```

`shipcheck scan` always scans the current working directory. Custom project paths, configuration files, and individual scanner commands are out of scope for v0.1.

---

## Core User Flow

### Local Scan

1. Developer opens a terminal in the root of a Node.js or TypeScript repository.
2. Developer runs `shipcheck scan`.
3. Shipcheck confirms that the working directory contains `package.json`.
4. Shipcheck runs the four scanners in a fixed order:
   - Git
   - Build
   - Tests
   - Environment
5. Each scanner returns a normalized result.
6. Shipcheck calculates a weighted readiness score.
7. Shipcheck prints a stable terminal report.
8. Local mode exits successfully after a completed report, even when the release gate fails. The report remains the source of truth for the developer.

### CI Scan

1. CI installs Shipcheck and project dependencies.
2. CI runs `shipcheck scan --ci`.
3. Shipcheck disables spinners and decorative terminal behavior.
4. Shipcheck performs the same four checks and prints the same ordered report.
5. Shipcheck exits with code `0` only when the readiness status is `READY`.
6. Shipcheck exits with code `1` when the status is `REVIEW` or `NOT READY`.
7. Bootstrap or command-usage failures use exit code `2`.

---

## Scanner Behavior

### Git Scanner

The Git scanner answers:

- Is the current directory inside a Git work tree?
- What branch is currently checked out?
- Is the working tree clean?

Untracked, staged, or unstaged changes make the check fail. A detached `HEAD` is reported clearly but does not fail by itself. A non-Git directory fails the check.

### Build Scanner

The Build scanner:

- Reads `package.json`
- Confirms that `scripts.build` exists
- Runs `npm run build` in the scanned project
- Passes only when the command exits with code `0`

A missing build script is a failed check in v0.1 because the product is intentionally aimed at release-ready Node.js and TypeScript services.

### Test Scanner

The Test scanner:

- Reads `package.json`
- Confirms that `scripts.test` exists
- Runs `npm test` with `CI=true`
- Passes only when the command exits with code `0`

Shipcheck does not add framework-specific flags. The project's own test script remains responsible for selecting Jest, Vitest, Node Test Runner, or another framework.

### Environment Scanner

The Environment scanner:

- Reads required variable names from `.env.example`
- Reads available variable names from `process.env`, `.env`, and `.env.local`
- Never prints, logs, or stores environment-variable values
- Fails when one or more declared names are missing or empty
- Skips when `.env.example` does not exist

The scanner validates presence only. It does not validate whether a value is a real credential, URL, number, or production-safe setting.

---

## Result Model

Every scanner returns the same result shape:

```typescript
type ScanStatus = "passed" | "failed" | "skipped" | "error";

type ScanResult = {
  id: "git" | "build" | "test" | "env";
  name: string;
  status: ScanStatus;
  summary: string;
  details: string[];
  durationMs: number;
  weight: number;
};
```

Status meaning:

| Status    | Meaning                                                        |
| --------- | -------------------------------------------------------------- |
| `passed`  | The check ran and its release condition was satisfied          |
| `failed`  | The check ran or was inspected and its condition was not met    |
| `skipped` | The check was not applicable, such as no `.env.example` present |
| `error`   | The scanner encountered an unexpected operational failure       |

An `error` never stops the remaining scanners. It is treated as a failed applicable check for scoring.

---

## Scoring and Release Decision

Each v0.1 scanner has a weight of 25:

| Scanner     | Weight |
| ----------- | -----: |
| Git         |     25 |
| Build       |     25 |
| Tests       |     25 |
| Environment |     25 |

Skipped checks are removed from both the numerator and denominator. This prevents a project with no declared environment contract from being penalized while still making the skip visible.

```text
score = passed applicable weight / total applicable weight × 100
```

The final score is rounded to the nearest whole number.

| Score  | Status      | Release gate |
| ------ | ----------- | ------------ |
| 90–100 | `READY`     | Pass         |
| 70–89  | `REVIEW`    | Fail         |
| 0–69   | `NOT READY` | Fail         |

`REVIEW` means the project may be close, but Shipcheck does not approve it for CI release.

---

## Example Output

```text
Shipcheck v0.1.0

Project: xpress-api
Path: /workspace/xpress-api

✓ Git          Working tree is clean (main)
✓ Build        npm run build passed
✓ Tests        npm test passed
✗ Environment Missing: PAYSTACK_SECRET_KEY

Checks: 3 passed, 1 failed, 0 skipped
Release score: 75/100
Status: REVIEW
Release gate: FAILED
```

No secret values appear in output. Failure details are concise and must not dump full command output unless a future explicit verbose mode is added.

---

## Features In Scope

- NestJS standalone application context with no HTTP server
- `nest-commander` command layer
- `shipcheck --help` and `shipcheck --version`
- `shipcheck scan`
- `shipcheck scan --ci`
- Current-working-directory project discovery
- `package.json` validation
- Git scanner
- Build scanner using `npm run build`
- Test scanner using `npm test`
- Environment scanner using `.env.example`
- Shared scanner contract and result type
- Equal-weight readiness scoring
- `READY`, `REVIEW`, and `NOT READY` statuses
- Stable terminal reporter
- TTY-aware spinner and color behavior
- CI exit codes
- Unit tests for every scanner, scoring, and reporting
- Integration tests using temporary fixture repositories
- Executable package metadata through the `bin` field

---

## Features Out of Scope

- `shipcheck init`
- `shipcheck.yml` or any user configuration file
- Custom scanner weights or thresholds
- JSON, HTML, Markdown, or file reports
- Lint scanner
- Test-coverage scanner
- Dependency audit or vulnerability scanning
- Outdated-package checks
- API health checks
- Dockerfile or container-build checks
- Git remote, ahead/behind, commit-message, or pull-request checks
- Package-manager auto-detection for Yarn, pnpm, or Bun
- Python, Flutter, Go, Java, or .NET support
- Plugins or third-party scanner SDK
- Parallel scanner execution
- Watch mode
- Interactive prompts
- Network calls, telemetry, accounts, persistence, or database
- Automatic fixes or other Shipcheck-owned mutations to the scanned repository
- Publishing to npm as part of the v0.1 implementation plan

Anything in this list requires a later version decision. It must not be quietly added while implementing v0.1.

---

## Target User

A backend engineer or small engineering team that:

- Maintains a Node.js or TypeScript service
- Uses npm scripts for build and test tasks
- Wants one repeatable pre-release command
- Needs local feedback and a CI-compatible release gate
- Values understandable checks over opaque automation

---

## Success Criteria

- A developer can install or link the package and run `shipcheck scan` from another repository
- `--help` and `--version` work without bootstrapping an HTTP server
- The four scanners always run in the documented order
- One scanner failure does not prevent later scanners from running
- Build and test subprocesses run in the scanned repository, not Shipcheck's repository
- The environment scanner never exposes secret values
- Scoring is deterministic for the same result set
- Skipped environment checks are visible and excluded from the denominator
- Local mode prints a complete report without acting as a hard gate
- CI mode returns the documented exit codes
- Terminal output remains readable with color disabled and in non-TTY environments
- Unit and integration tests cover success, failure, skip, timeout, and unexpected-error paths
- Shipcheck-owned operations never edit the scanned repository; verification accounts for files generated or changed by repository-owned build and test scripts
