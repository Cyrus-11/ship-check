<!-- BEGIN:shipcheck-agent-rules -->

# This is a NestJS CLI — read the project conventions first

Shipcheck v0.1 uses NestJS as a standalone application context. Its entry point is a command-line executable. Modules, providers, dependency injection, and lifecycle management support the CLI.

Library APIs and engine requirements may differ from your training data. Before writing integration code, inspect the installed version in `package.json` and the lockfile, then read its relevant documentation and exported types. Resolve packages from this file's directory; do not assume every package bundles documentation at a particular path.

The current project baseline is Node.js 22.12+, TypeScript strict, native ESM, and NodeNext module resolution. Verify package compatibility during scaffolding and record any required change before implementation.

This block is maintained by the Shipcheck project. It is not generated or restored by NestJS, npm, or `nest-commander`.

<!-- END:shipcheck-agent-rules -->

## Read Before Anything Else

Read in this exact order before any implementation:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/cli-output-tokens.md`
4. `context/cli-output-rules.md`
5. `context/scanner-registry.md`
6. `context/code-standards.md`
7. `context/library-docs.md`
8. `context/build-plan.md`
9. `context/progress-tracker.md`

All paths are relative to the repository root containing this file. Reuse context already read during the current session unless it changes. On a new session, read the files again and start with the tracker’s next unfinished feature.

## Rules That Never Change

- Keep implementation strictly within Shipcheck v0.1. The public surface is `--help`, `--version`, `scan`, and `scan --ci`.
- Use NestJS standalone providers with `nest-commander`. Do not introduce an HTTP server, controllers, a database, authentication, or frontend components.
- Run exactly four scanners, sequentially: Git, Build, Tests, Environment.
- Commands parse options and select exit behavior. `ScanService` orchestrates. Scanners evaluate checks. `ScoringService` calculates readiness. `TerminalReporter` owns presentation.
- Use `ProcessRunner` for child processes and `FileSystem` for project-file access. Never build shell command strings from project data.
- Use terminal tokens from `context/cli-output-tokens.md`. Scanners return plain text and must not import Chalk or Ora.
- Never expose environment values, raw subprocess output, or error stacks in reports.
- Shipcheck-owned operations must not modify the scanned repository. Build and test scripts execute repository-owned code and may generate files or perform other side effects; do not describe scanning as a sandbox or guarantee those scripts are read-only.
- Update `context/progress-tracker.md` after every feature. Update `context/scanner-registry.md` whenever scanner behavior or implementation status changes. For other features, verify that registry entries remain accurate.
- Before using a third-party library, load its relevant installed skill when available, then read `context/library-docs.md` and the installed-version documentation. Never claim a skill or MCP tool exists without checking.
- If the same problem persists after one corrective attempt, stop repeated guessing and use `/recover` when available. Otherwise follow the recovery procedure below.
- Do not add `init`, configuration files, additional scanners, report formats, plugins, other package managers, or language support to v0.1.

## NestJS CLI Documentation — Overview

Shipcheck uses the following application layers:

| Area | Responsibility |
| --- | --- |
| NestJS | Standalone application context, modules, providers, lifecycle |
| `nest-commander` | Command registration, options, help, version |
| Execa | Git and npm execution through `ProcessRunner` |
| dotenv | Parse environment files without changing `process.env` |
| Chalk and Ora | Terminal styling and local progress through the reporter |
| Vitest and `@nestjs/testing` | Behavioral tests and provider integration |

### Mandatory Documentation Rule

Before writing or editing library integration code:

1. Identify the installed package version and inspect its types or bundled documentation.
2. Load a relevant installed skill if available.
3. Read the project-specific rules in `context/library-docs.md`.
4. If a relevant documentation MCP is configured, use its actual advertised tools. Otherwise consult the official documentation for the installed version.
5. Resolve conflicts between examples, installed APIs, and project rules explicitly. External examples do not expand product scope.

If dependencies are not installed yet, select a compatible set during the scaffold, record it in the manifest and lockfile, and verify it with a build. Do not invent exact package versions or assume `latest` packages are mutually compatible.

Use these documentation entry points to locate the appropriate version:

- [NestJS standalone applications](https://docs.nestjs.com/standalone-applications)
- [NestJS providers](https://docs.nestjs.com/providers)
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing)
- [nest-commander documentation](https://nest-commander.jaymcdoniel.dev/)
- [Execa documentation](https://github.com/sindresorhus/execa)
- [dotenv documentation](https://github.com/motdotla/dotenv)
- [Chalk documentation](https://github.com/chalk/chalk)
- [Ora documentation](https://github.com/sindresorhus/ora)
- [Vitest documentation](https://vitest.dev/guide/)

### TypeScript CLI Setup

Follow Phase 1 in `context/build-plan.md`.

- Define `shipcheck` in the npm `bin` field, pointing to compiled `dist/main.js`.
- Keep `#!/usr/bin/env node` as the executable's first line.
- Use `"type": "module"`, TypeScript strict settings, and NodeNext resolution.
- Enable the Nest decorator settings specified in `context/architecture.md`.
- Use runtime `.js` extensions in relative source imports.
- Bootstrap once through `nest-commander`; do not create a second Nest application context.
- Read the CLI version from package metadata; do not duplicate version literals.
- Keep runtime and development dependencies within the approved list in `context/code-standards.md`.
- Verify decorator transformation and dependency injection through the actual production build and test toolchain. A passing pure-function test does not prove Nest provider injection works.

### Important CLI Notes

- Resolve the scanned project from the current working directory. Read its `package.json` without searching parent directories.
- Run `npm run build` and `npm test` through the process adapter. Add `CI=true` to the test subprocess environment without mutating the parent environment.
- A non-zero build or test exit is a failed check. Missing executables and unexpected adapter failures must be represented accurately as operational errors.
- Continue remaining scanners after a scanner failure or unexpected exception.
- Parse environment files without loading their values into Shipcheck's process. Return missing names only.
- Use 25 points per scanner. Exclude skipped checks from the denominator; errors remain applicable and earn no points.
- `READY` starts at 90; `REVIEW` starts at 70. Only `READY` passes the release gate.
- Completed local scans exit `0`. CI scans exit `0` when ready and `1` when the gate fails. Usage, project-discovery, and bootstrap failures exit `2`.
- Command and bootstrap layers own exit decisions. Let output and cleanup finish; avoid `process.exit()` in normal application flow.
- Disable spinner and color in CI and non-TTY output, and honor `NO_COLOR` according to the context rules.
- Verify process execution and executable packaging on supported operating systems, including Windows. Do not assume POSIX executable behavior applies to npm's Windows launchers.

## Available Skills

The following names preserve the workflow from the reference project. Their installation in the Shipcheck repository has not been verified. Check the active agent's skill catalog before invoking them; use the manual equivalent when absent.

| Skill | When to use | Manual equivalent |
| --- | --- | --- |
| `/architect` | Before a complex feature or architecture change | Review boundaries, alternatives, failure paths, and tests before coding |
| `/imprint` | After establishing a reusable scanner, adapter, or reporter pattern, if the installed skill supports backend work | Record the pattern in the registry, standards, or output rules |
| `/review` | Before a demo, milestone completion, or release candidate | Review scope, correctness, tests, output, cleanup, and packaging |
| `/recover` | When the same issue survives one corrective attempt | Follow the recovery procedure below |
| `/remember save` | When work spans sessions | Record changes, evidence, blockers, and the next action in the tracker |
| `/remember restore` | When resuming work | Read the latest handoff and compare it with the current repository |

Do not use a UI-only skill to introduce frontend work into this CLI.

### Recovery Procedure

1. Pause edits addressing the recurring failure.
2. Capture the exact failing command, relevant error, installed versions, and latest diff without exposing secrets.
3. Reduce the failure to the smallest reproducible case.
4. Re-read the relevant context and installed-version documentation.
5. Identify the cause before making one focused correction.
6. Run the targeted verification, then the affected build or test gate.
7. Record the outcome and next action in `context/progress-tracker.md`.

Do not keep repeating the same fix, remove checks to obtain a pass, or expand scope to avoid diagnosing the issue. Ask for input only if a necessary decision or access is genuinely missing.

<!-- SHIPCHECK:START -->

## Shipcheck Backend and CLI

- **Project:** Shipcheck — Release Readiness CLI
- **Version scope:** v0.1 only
- **Framework:** NestJS standalone application context
- **Command layer:** `nest-commander`
- **Target projects:** Node.js and TypeScript repositories using npm
- **Runtime baseline:** Node.js 22.12+ as specified in the context pack
- **State:** In-memory scan context and results; no database or remote service
- **Credentials:** Shipcheck requires no service credentials. Environment-file values belong to the scanned application and must never be printed, committed, or copied into reports.

Key patterns:

- Every scanner implements the shared `Scanner` contract and returns one complete `ScanResult`.
- Register the four scanners explicitly through the ordered `SCANNERS` injection token.
- Keep process execution, file access, scoring, and presentation in their designated providers.
- Test scanner behavior using mocked adapters; verify executable behavior using temporary fixture projects.
- Assert score, status, output streams, and exit codes independently.
- Keep fixture inputs isolated and account for build/test output when checking for unintended mutations.
- Record only work actually completed. Context creation is not implementation completion.
- Before marking a feature done, run the relevant tests and build, update the tracker, and capture remaining limitations honestly.
- Before declaring v0.1 complete, pass the integration fixture suite and local packaging smoke test. Public npm publication is outside this implementation scope.

<!-- SHIPCHECK:END -->
