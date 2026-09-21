# Architecture

## Stack

| Layer                  | Tool / Pattern                      | Purpose                                                   |
| ---------------------- | ----------------------------------- | --------------------------------------------------------- |
| Runtime                | Node.js 22.12+                       | Executes the CLI and satisfies the current Vitest engine  |
| Language               | TypeScript strict                   | Type-safe implementation                                  |
| Application framework  | NestJS standalone context           | Modules, providers, dependency injection, lifecycle       |
| CLI framework          | `nest-commander`                    | Commands, flags, help, version handling                    |
| Process execution      | `execa`                             | Runs Git and npm commands with captured results/timeouts   |
| Environment parsing    | `dotenv`                            | Parses `.env.example`, `.env`, and `.env.local` safely     |
| Terminal color         | `chalk`                             | Semantic status color with automatic color suppression     |
| Spinner                | `ora`                               | Local TTY progress only                                    |
| Unit/integration tests | Vitest                              | Fast TypeScript tests, mocks, fixtures, coverage            |
| Nest testing           | `@nestjs/testing`                   | Creates focused dependency-injection test modules          |
| Packaging              | npm `bin` field + compiled `dist/`  | Exposes the `shipcheck` executable                          |

There is no HTTP adapter, controller, database, authentication, telemetry, or frontend in v0.1.

---

## Runtime Model

Shipcheck is a NestJS application context, not a Nest web server. `nest-commander` creates and closes the application context around the selected command.

```typescript
#!/usr/bin/env node

import "reflect-metadata";

import { bootstrap } from "./bootstrap.js";

void bootstrap();
```

`src/bootstrap.ts` calls `CommandFactory.run()` once with logging and plugins disabled, `abortOnError: false`, and the package-derived version. The root command is registered through `CommandsModule`; its metadata supplies the product name and description. No HTTP server is created.

With nest-commander 3.21.0 / Commander 11.1.0, the root and child commands each need a throwing parser exit override: returning would let Commander call `process.exit()` before cleanup, and independently constructed child commands do not inherit the root override. The shared `throwParserExit` helper wraps parser callback errors in `ParserExitSignal`. Bootstrap's `serviceErrorHandler` recognizes only that project-owned wrapper, records success for help/version or exit `2` for invalid usage, and rethrows unexpected errors. Ordinary errors with lookalike parser codes still fail. The bootstrap applies parser exit decisions after the factory finishes asynchronous shutdown. Metadata, startup, execution, or cleanup failures produce a fixed safe stderr message and exit `2`. Factory shutdown applies after application creation succeeds; the factory does not expose a partially created context when startup rejects.

`src/common/package-version.ts` imports Shipcheck's own package metadata using a URL relative to its compiled module, independent of the scanned project's working directory. This package read does not belong to scanned-project discovery or the future `FileSystem` adapter.

Feature 03 registers `ScanCommand` alongside the root provider. `CommandsModule` imports `ScanModule`, which exports `ScanService`. The command rejects positional arguments explicitly, normalizes its boolean `--ci` option, awaits the service, and selects the completed-command exit through `selectExitCode`. The temporary service returns only `{ gatePassed: false }`, with no discovery, scanners, or output: the shell exits `0` locally and `1` in CI. Feature 04 defines the full domain contracts below and replaces `ScanShellReport` with `Pick<ScanReport, "gatePassed">` in the service and exit selector. Full report assembly remains a later feature; the selector will accept a complete report without changing its narrow dependency.

---

## Module System

Shipcheck uses native ECMAScript modules because current versions of terminal and process libraries are ESM-first.

Required project conventions:

```json
{
  "type": "module"
}
```

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Relative TypeScript imports use the runtime `.js` extension, for example `./app.module.js`. Path aliases are not introduced in v0.1 because compiled Node ESM does not resolve TypeScript-only aliases without extra runtime tooling.

---

## Folder Structure

```text
/
├── AGENTS.md
├── context/
│   ├── project-overview.md
│   ├── architecture.md
│   ├── cli-output-tokens.md
│   ├── cli-output-rules.md
│   ├── scanner-registry.md
│   ├── code-standards.md
│   ├── library-docs.md
│   ├── build-plan.md
│   └── progress-tracker.md
├── src/
│   ├── main.ts                              → Executable bootstrap
│   ├── app.module.ts                        → Root Nest module
│   ├── commands/
│   │   ├── commands.module.ts               → Registers command providers
│   │   ├── scan.command.ts                  → Parses `scan` and `--ci`
│   │   └── scan-command.options.ts          → Command option type
│   ├── scan/
│   │   ├── scan.module.ts                   → Orchestration composition
│   │   └── scan.service.ts                  → Runs scanner pipeline
│   ├── scanners/
│   │   ├── scanners.module.ts               → Scanner providers + registry token
│   │   ├── scanner.tokens.ts                → `SCANNERS` injection token
│   │   ├── git/
│   │   │   └── git.scanner.ts
│   │   ├── build/
│   │   │   └── build.scanner.ts
│   │   ├── test/
│   │   │   └── test.scanner.ts
│   │   └── env/
│   │       └── env.scanner.ts
│   ├── scoring/
│   │   ├── scoring.module.ts
│   │   └── scoring.service.ts
│   ├── reporter/
│   │   ├── reporter.module.ts
│   │   └── terminal-reporter.service.ts
│   ├── infrastructure/
│   │   ├── infrastructure.module.ts
│   │   ├── process-runner.service.ts        → Only provider allowed to spawn commands
│   │   ├── file-system.service.ts           → Read-only filesystem wrapper
│   │   └── clock.service.ts                 → Duration measurement seam
│   └── common/
│       ├── constants/
│       │   ├── exit-codes.ts
│       │   ├── scan-order.ts
│       │   └── scoring.ts
│       ├── contracts/
│       │   └── scanner.contract.ts
│       └── types/
│           ├── package-json.type.ts
│           ├── scan-context.type.ts
│           ├── scan-report.type.ts
│           └── scan-result.type.ts
├── test/
│   ├── unit/
│   │   ├── commands/
│   │   ├── scanners/
│   │   ├── scoring/
│   │   └── reporter/
│   ├── integration/
│   │   └── scan.integration.spec.ts
│   ├── fixtures/
│   │   ├── ready-project/
│   │   ├── dirty-git-project/
│   │   ├── failing-build-project/
│   │   ├── failing-test-project/
│   │   └── missing-env-project/
│   └── helpers/
│       └── fixture-repository.ts
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── eslint.config.js
├── .gitignore
├── LICENSE
└── README.md
```

Tests remain outside `src/` so production builds only emit runtime code.

Feature 01 adds `tsconfig.test.json` alongside the production build configuration. `npm test` first builds `dist/`, then compiles source and tests into ignored `.test-dist/` using the same TypeScript decorator options. Vitest runs the emitted test JavaScript, while executable smoke tests run the production `dist/main.js`. This verifies Nest constructor injection without relying on a different test transformer to emit metadata.

---

## System Boundaries

| Area              | Owns                                                                 | Must not own                                      |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| `commands/`       | CLI metadata, option parsing, exit-code selection                    | Scanner logic, scoring formulas, process calls    |
| `scan/`           | Pipeline orchestration and report assembly                           | Git/npm details, terminal styling                  |
| `scanners/`       | One release-readiness rule per scanner                               | Cross-scanner scoring or process implementation    |
| `scoring/`        | Weight calculation and readiness status                              | Terminal output or process exit                    |
| `reporter/`       | Human-readable terminal rendering                                    | Scanner execution or release policy changes        |
| `infrastructure/` | Process, filesystem, and timing adapters                             | Product decisions                                  |
| `common/`         | Shared contracts, types, constants                                   | Stateful services or feature logic                 |
| `test/`           | Unit tests, integration tests, isolated repository fixtures          | Production runtime code                            |

---

## Dependency Direction

```text
ScanCommand
    ↓
ScanService
    ├── SCANNERS → Scanner[]
    ├── ScoringService
    └── TerminalReporter

Scanner implementations
    ├── ProcessRunner
    ├── FileSystem
    └── Clock
```

Dependencies flow inward through contracts. Scanners never import the command or reporter. The reporter never spawns commands. Infrastructure never knows readiness policy.

---

## Core Contracts

### Canonical Policy and IDs

`common/constants/scan-order.ts` defines the frozen literal tuple `SCAN_ORDER`: `git`, `build`, `test`, `env`. `ScannerId` is derived from this tuple in `common/types/scanner-id.type.ts`. This is policy data; the `SCANNERS` injection registry remains feature 11.

`common/constants/scoring.ts` defines frozen `SCANNER_WEIGHTS` (25 for each ID, total 100) and `READINESS_THRESHOLDS` (`READY: 90`, `REVIEW: 70`). The weight map is checked against `Record<ScannerId, number>`. The existing `EXIT_CODE` constants are reused unchanged. Domain contracts contain no framework or terminal-library types, and use type-only imports.

### Package Metadata Subset

```typescript
export type PackageJson = {
  readonly name?: string;
  readonly scripts?: {
    readonly build?: string;
    readonly test?: string;
  };
};
```

This is a validated in-memory projection, not arbitrary parsed JSON or the complete npm manifest. Feature 06 must narrow unknown input, select supported string fields, and omit unsupported or non-string fields without asserting raw JSON as `PackageJson`. Name fallback and missing-script behavior then apply as documented. Blank strings remain representable for discovery/scanner checks. No parsing or project access is implemented by these types.

### Scan Context

```typescript
export type ScanContext = {
  readonly cwd: string;
  readonly projectName: string;
  readonly packageJsonPath: string;
  readonly packageJson: PackageJson;
  readonly ci: boolean;
};
```

The context will be created once by `ScanService`. Scanners do not independently choose a working directory. Context and nested package fields are readonly through their TypeScript contracts; this is not a runtime deep-freeze guarantee.

### Scanner Contract

```typescript
export interface Scanner {
  readonly id: ScannerId;
  readonly name: string;
  readonly weight: number;
  run(context: ScanContext): Promise<ScanResult>;
}
```

An interface is used here because scanner implementations share an extendable behavioral contract.

### Result and Report

```typescript
export type ScanStatus = "passed" | "failed" | "skipped" | "error";

export type ScanResult = {
  id: ScannerId;
  name: string;
  status: ScanStatus;
  summary: string;
  details: string[];
  durationMs: number;
  weight: number;
};

export type ReadinessStatus = "READY" | "REVIEW" | "NOT_READY";

export type ScanReport = {
  projectName: string;
  cwd: string;
  results: ScanResult[];
  score: number;
  status: ReadinessStatus;
  gatePassed: boolean;
  durationMs: number;
};
```

Each primary type lives in its own `common/types/*.type.ts` file. All result/report fields remain required. Durations, weights, and scores are numbers; types alone do not enforce runtime ranges, report completeness, or score/status/gate consistency. Those checks belong to subsequent providers. Result and report arrays retain the mutable shapes above.

---

## Scanner Registry

Nest does not provide implicit multi-binding. `ScannersModule` exposes an explicit array through one injection token:

```typescript
export const SCANNERS = Symbol("SCANNERS");

const scannerRegistryProvider = {
  provide: SCANNERS,
  inject: [GitScanner, BuildScanner, TestScanner, EnvScanner],
  useFactory: (
    git: GitScanner,
    build: BuildScanner,
    test: TestScanner,
    env: EnvScanner,
  ): Scanner[] => [git, build, test, env],
};
```

The array order is product behavior. Do not sort scanners alphabetically or discover them dynamically in v0.1.

---

## Execution Flow

```text
$ shipcheck scan [--ci]
          ↓
     ScanCommand
          ↓
     ScanService
          ↓
  validate package.json
          ↓
 Git → Build → Tests → Environment
          ↓
    ScanResult[]
          ↓
   ScoringService
          ↓
     ScanReport
          ↓
 TerminalReporter
          ↓
 select exit code
```

Scanners run sequentially in v0.1. This produces deterministic progress output and avoids running build and test commands against the same repository at the same time.

---

## Project Discovery

`ScanService` resolves `process.cwd()` once and reads `<cwd>/package.json`.

Failure rules:

- Missing `package.json` → fatal command error, print a concise message, exit `2`
- Invalid JSON → fatal command error, exit `2`
- Missing or blank package name → use the directory basename as `projectName`
- Non-Node repository → no heuristic fallback; v0.1 ends with the fatal error

Project discovery does not walk parent directories.

---

## Process Runner

All external commands go through `ProcessRunner`. Scanners never import `execa` directly.

```typescript
export type ProcessRequest = {
  file: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
};

export type ProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};
```

Rules:

- Always pass `shell: false` and separate executable/arguments; never construct a shell command. User-approved Feature 05 exception: Execa may internally use cmd.exe for the resolved Windows npm.cmd launcher. Other Windows launcher formats are unsupported; native .exe/.com commands run directly.
- Command and arguments are separate values
- Capture output instead of inheriting the terminal
- Use `reject: false` so non-zero exits become scanner results
- Enforce a 120-second timeout for build and test commands
- Limit captured stdout/stderr to 1,000,000 bytes per stream; never put raw output or excerpts in reports
- Keep captured output and internal error causes private; public operational errors have fixed safe messages
- Preserve the parent environment and add `CI=true` only for the test command

Feature 05 distinguishes ordinary numeric exits from operational failures. Timeouts return `timedOut: true` with synthetic exit code 1; missing executables/cwd and start failures throw ProcessStartError. Output limits, invalid requests, signals, and unexpected adapter failures throw ProcessExecutionError. Inspect failure flags before numeric exits, since a buffer-limit failure may have exit code 0. Windows executable lookup happens through FileSystem before Execa to prevent its missing-command shell fallback from masquerading as exit 1. App Execution Aliases that deny metadata access and arbitrary shebang/batch launchers are unsupported and fail safely.

InfrastructureModule exports ProcessRunner, FileSystem, and Clock without starting another context or connecting them to the temporary scan shell. FileSystem reads UTF-8 text, checks existence (only ENOENT means false), and resolves Windows executable files; Clock uses monotonic performance.now(). Descendant termination is best-effort through Execa and is not a sandbox guarantee.

---

## Scanner Algorithms

### Git

```text
git rev-parse --is-inside-work-tree
git branch --show-current
git status --porcelain
```

- First command failure → failed, "Not a Git repository"
- Empty branch output → report "detached HEAD"
- Any porcelain output → failed, report changed-file count only
- Empty porcelain output → passed

File names from `git status` are not printed in v0.1.

### Build

```text
read packageJson.scripts.build
if absent → failed
run: npm run build
timeout: 120 seconds
exit 0 → passed
non-zero or timeout → failed
spawn error → error
```

### Tests

```text
read packageJson.scripts.test
if absent → failed
run: npm test
environment: existing env + CI=true
timeout: 120 seconds
exit 0 → passed
non-zero or timeout → failed
spawn error → error
```

### Environment

```text
if .env.example absent → skipped
parse required names from .env.example
parse .env when present
parse .env.local when present
merge available names with process.env
empty string counts as missing
missing names → failed
otherwise → passed
```

Only names may enter `details`. Values must be discarded immediately after presence evaluation.

---

## Scoring Algorithm

```typescript
const applicable = results.filter((result) => result.status !== "skipped");
const denominator = applicable.reduce((sum, result) => sum + result.weight, 0);
const numerator = applicable
  .filter((result) => result.status === "passed")
  .reduce((sum, result) => sum + result.weight, 0);

const score = denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
```

Status rules:

```typescript
if (score >= 90) return "READY";
if (score >= 70) return "REVIEW";
return "NOT_READY";
```

The release gate passes only for `READY`.

---

## Exit Codes

| Code | Meaning                                                                 |
| ---: | ----------------------------------------------------------------------- |
| `0`  | Help/version, or completed local scan, or CI scan with `READY` status    |
| `1`  | Completed CI scan with `REVIEW` or `NOT READY` status                    |
| `2`  | Invalid command usage, missing/invalid project metadata, bootstrap error |

Use `process.exitCode`; do not call `process.exit()` inside services. This allows buffered terminal output and application cleanup to finish.

---

## Test Architecture

### Unit Tests

- Scanner tests mock `ProcessRunner`, `FileSystem`, and `Clock`
- Scoring tests use table-driven result sets
- Reporter tests inject a writer and color capability instead of patching global console behavior
- Command tests mock `ScanService` and verify exit-code selection

### Integration Tests

- Each test copies a fixture into a unique temporary directory
- Git-dependent fixtures are initialized inside the temporary copy
- Tests never mutate committed fixture sources
- Mutation checks distinguish Shipcheck-owned changes from expected build/test script side effects in temporary fixture copies
- Integration tests run the compiled CLI as a child process
- Color and spinner behavior are disabled for stable assertions
- Exit code, stdout, and stderr are asserted independently

---

## Security and Privacy Boundaries

- Shipcheck does not make network requests
- Scanned-project file access stays within the current project; Shipcheck also loads its own installed runtime and package metadata, and FileSystem reads executable metadata on Windows before the operating system/Execa launches the resolved command
- Shipcheck-owned operations never write to the scanned repository
- Environment values are never placed in result objects
- Subprocesses run without `shell: true`
- Repository-owned build and test scripts execute with the user's permissions and may generate files or perform other side effects; scanning is not a sandbox
- Shipcheck must only be run in repositories the user trusts, because `npm run build` and `npm test` execute repository-owned code

---

## Invariants

- No controllers, HTTP adapters, ports, REST routes, Swagger, guards, or web middleware
- Command/bootstrap layers own exit decisions; `ScanCommand` will select completed-scan exits
- Only `ScanService` orchestrates the full scanner sequence
- Only `ProcessRunner` starts child processes
- Only `TerminalReporter` formats user-facing scan output
- Scanner order is Git, Build, Tests, Environment
- Scanner weights are defined once and total 100 before skips
- A scanner exception becomes an `error` result and never aborts later scanners
- Build and test commands always run with the scanned project as `cwd`
- Environment values never leave `EnvScanner`
- The current working directory is resolved once per command
- Shipcheck-owned operations never modify the scanned repository; repository-owned build/test scripts may do so
- Every behavior added to v0.1 must be represented in this context pack and the progress tracker
