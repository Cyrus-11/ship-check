# Code Standards

Implementation rules for Shipcheck v0.1. Every coding session must follow these rules so the CLI remains predictable, testable, and within scope.

---

## Engineering Mindset

- **Read context first** — begin with `project-overview.md`, `architecture.md`, and the current item in `progress-tracker.md`
- **Scope is fixed** — build only the v0.1 command surface and four approved scanners
- **Behavior before abstraction** — define observable input, output, and exit behavior before implementation
- **Read-only in Shipcheck-owned operations** — never change the scanned repository directly; repository-owned build/test scripts may generate files or perform other side effects
- **One feature at a time** — finish code, tests, and tracker update before starting the next feature
- **Determinism matters** — scanner order, messages, score, and plain output must be stable
- **Failures are data** — repository failures become results; unexpected failures become `error` results
- **Simple over clever** — explicit providers and small services are preferred to reflection or auto-discovery
- **Security is part of correctness** — never leak environment values or construct shell commands; only Execa's internal Windows npm.cmd launcher is permitted as documented in architecture

---

## TypeScript

- `strict: true` with no exceptions
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- Never use `any`; use `unknown` and narrow
- Do not suppress compiler errors with `@ts-ignore`
- `@ts-expect-error` is allowed only in a test that proves an invalid type and must explain why
- All exported functions and all class methods have explicit return types
- All async functions return an explicit `Promise<T>`
- Use `const` unless reassignment is required
- Use `readonly` for injected dependencies and immutable fields
- Use `type` for data shapes and unions
- Use `interface` only for behavioral contracts intended for implementations, such as `Scanner`
- Prefer discriminated unions and literal types to booleans with ambiguous meaning
- Never use non-null assertion (`!`) when validation can narrow the value
- Type assertions require a nearby explanation when unavoidable

---

## ECMAScript Modules

- Package uses `"type": "module"`
- TypeScript uses `module: "NodeNext"` and `moduleResolution: "NodeNext"`
- Relative imports include the runtime `.js` extension
- Use `node:` prefixes for Node built-ins
- Never use `require`, `module.exports`, `__dirname`, or `__filename`
- When a directory path is required, derive it from `import.meta.url`
- Do not add path aliases in v0.1

```typescript
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Injectable } from "@nestjs/common";
import { ScanResult } from "../common/types/scan-result.type.js";
```

---

## NestJS Boundaries

- Use modules, singleton providers, constructor injection, and lifecycle management
- Use `CommandFactory.run()`; never use `NestFactory.create()`
- Do not install or import `@nestjs/platform-express` or `@nestjs/platform-fastify`
- No controllers, routes, DTO pipelines, guards, interceptors, filters, Swagger, or HTTP middleware
- Commands are registered as providers in `CommandsModule`
- Scanners are providers in `ScannersModule`
- Keep modules small and explicit; no global modules in v0.1
- Avoid circular dependencies and `forwardRef`
- Do not use request-scoped or transient providers
- Use injection tokens for abstraction collections such as `SCANNERS`

---

## File and Folder Naming

- Folders: kebab-case — `scanners`, `infrastructure`
- Source files: kebab-case with responsibility suffix — `git.scanner.ts`, `scan.service.ts`
- Type files: kebab-case with `.type.ts`
- Contract files: kebab-case with `.contract.ts`
- Constant files: kebab-case with descriptive name — `exit-codes.ts`
- Test files: same base name plus `.spec.ts`
- One runtime class per file
- One primary exported type/contract per type file
- Do not create barrel `index.ts` files

---

## Import Order

Every source file uses this order, separated by blank lines:

```typescript
// 1. Node built-ins
import { join } from "node:path";

// 2. Third-party packages
import { Injectable } from "@nestjs/common";
import { execa } from "execa";

// 3. Internal imports
import { Clock } from "../../infrastructure/clock.service.js";
import { ScanContext } from "../../common/types/scan-context.type.js";

// 4. Type-only imports use `import type`
import type { Scanner } from "../../common/contracts/scanner.contract.js";
```

- Use `import type` when the import is erased at runtime
- Never use wildcard imports unless a library requires them
- Do not import directly across feature internals when a module contract exists

---

## Class Structure

Use this order inside provider classes:

1. Public readonly identity fields
2. Constructor
3. Public methods
4. Private methods

```typescript
@Injectable()
export class GitScanner implements Scanner {
  public readonly id = "git" as const;
  public readonly name = "Git";
  public readonly weight = 25;

  public constructor(
    private readonly processRunner: ProcessRunner,
    private readonly clock: Clock,
  ) {}

  public async run(context: ScanContext): Promise<ScanResult> {
    // orchestration
  }

  private countChanges(output: string): number {
    // focused transformation
  }
}
```

Do not use inheritance between scanners. Shared behavior belongs in a small collaborator or a pure helper.

---

## Scanner Rules

- A scanner performs one readiness check
- A scanner receives `ScanContext`; it never reads `process.cwd()`
- A scanner returns exactly one `ScanResult`
- All result fields are populated on every path
- `summary` and `details` contain plain text without color or ANSI codes
- Expected non-zero child exits are `failed`, not `error`
- Spawn failures and unexpected adapter failures are `error`
- A skip is allowed only where documented in `scanner-registry.md`
- Scanner weights come from one shared scoring constant map
- Scanner code never writes to stdout or stderr
- Scanner code never sets `process.exitCode`
- Scanner code never calls another scanner
- Scanner code never directly mutates the project; build/test scanners execute repository-owned scripts that may have side effects

---

## Process Execution

- Only `ProcessRunner` imports `execa`
- Never use `shell: true`
- Allow only native .exe/.com or the resolved npm.cmd launcher on Windows; the latter's Execa-managed cmd.exe invocation is the approved exception
- Pass the executable and argument array separately
- Always pass an explicit absolute `cwd`
- Always pass an explicit timeout
- Use `reject: false` so non-zero exit codes are returned, not thrown
- Distinguish non-zero exit, timeout, and spawn error
- Do not inherit child stdio in v0.1
- Limit buffered output
- Do not place raw `stdout` or `stderr` into public scan results
- Preserve the parent environment unless the scanner documents an override
- Test scanner adds `CI: "true"`; no other scanner changes it

See the implemented invocation and version-specific failure mapping in `context/library-docs.md`. Capture bytes with `encoding: "buffer"`; classify failure flags before checking numeric exits. Timeouts use the documented synthetic exit code, while operational failures throw safe project-owned errors.

Confirm option names against the installed Execa documentation before implementation.

---

## Filesystem Access

- Only `FileSystem` imports `node:fs/promises`
- Shipcheck-owned runtime filesystem operations are read-only
- Use absolute paths created with `node:path`
- `exists()` returns a boolean only for expected `ENOENT`; other errors propagate
- Read text as UTF-8 explicitly
- Never follow a guessed parent directory to locate a project
- Shipcheck code must never create, modify, rename, or delete files in the scanned project; this does not guarantee that repository-owned build/test scripts are read-only
- Temporary directories exist only in tests and are always outside committed fixtures

---

## Environment Safety

- Use `dotenv.parse()` on file content; do not use `dotenv.config()` against the scanned project
- Do not inject scanned `.env` values into Shipcheck's own `process.env`
- Keep parsed values local to `EnvScanner`
- Convert values immediately into presence checks
- Return missing names only
- Do not log, snapshot, serialize, or throw messages containing values
- Treat whitespace-only values as missing after trimming
- `process.env` values are read but never mutated

---

## Error Handling

- Never use an empty catch block
- Narrow caught values from `unknown`
- Use human-readable summaries from `cli-output-rules.md`
- Preserve internal causes where useful without displaying them
- Do not catch an error only to throw the same error unchanged
- `ScanService` provides the final per-scanner safety boundary
- One scanner error must not stop later scanners
- Fatal project discovery errors stop before scanners and map to exit code `2`
- Bootstrap errors map to exit code `2`
- Never call `process.exit()`

```typescript
try {
  return await scanner.run(context);
} catch (error: unknown) {
  return createScannerErrorResult(scanner, clock, error);
}
```

---

## Terminal Output

- Only `TerminalReporter` imports Chalk or Ora
- Inject `stdout`, `stderr`, TTY capability, and color capability for tests
- Build plain semantic text before adding style
- Use tokens from `cli-output-tokens.md`
- Follow section order from `cli-output-rules.md`
- Stable snapshots use color and spinner disabled
- Do not use `console.log` or `console.error` in application services
- Bootstrap is the only exception because DI may not be available

---

## Scoring

- Use exported constants for weights and thresholds
- Never hardcode 25, 70, or 90 inside scanner or reporter implementations
- Exclude only `skipped` results from the denominator
- Count `error` as applicable and not passed
- Round once at the end using `Math.round`
- Gate passes only when status is `READY`
- Scoring service returns data; it never prints or sets exit codes

---

## Exit Codes

Define once:

```typescript
export const EXIT_CODE = {
  SUCCESS: 0,
  GATE_FAILED: 1,
  USAGE_OR_INTERNAL: 2,
} as const;
```

- Local completed scan → `0`
- CI `READY` → `0`
- CI `REVIEW` or `NOT_READY` → `1`
- Invalid project, invalid usage, or bootstrap error → `2`
- Only command/bootstrap layers may set `process.exitCode`

---

## Testing Standards

- Every behavior has a positive and negative test
- Tests follow Arrange, Act, Assert without comments naming those phases
- Use Vitest `describe`, `it`, `expect`, and `vi`
- No test depends on the user's Git config, global npm packages, home directory, or network
- Unit tests mock ports, not private methods
- Integration tests use isolated temporary copies of fixtures
- Never edit a committed fixture during a test
- Reset environment changes in `afterEach`
- Restore mocks in `afterEach`
- Assert complete result objects for scanners
- Use table-driven tests for score/status boundaries
- Snapshot only stable reporter output, not error stacks or absolute temporary paths
- Integration tests assert exit code, stdout, and stderr separately
- Tests must pass with `NO_COLOR=1`
- Test names describe observable behavior, not implementation details

Minimum required quality gates for Shipcheck itself:

- `npm run build` passes
- `npm test` passes once
- `npm run lint` passes if lint is included in the initial scaffold
- No TypeScript errors
- No skipped tests committed without an explanation in `progress-tracker.md`

---

## Fixtures

- Fixtures are minimal Node projects, not copies of real applications
- Never place real credentials or realistic secrets in fixtures
- Example values use obvious placeholders such as `test-only`
- Git repositories are initialized at test runtime
- Fixture scripts must be cross-platform Node commands, not Bash-only commands
- Failing scripts exit intentionally through Node
- Slow/timeout fixtures use controlled fake adapters in unit tests where possible

---

## Comments and Documentation

- Comments explain why, not what
- Public contracts may have short TSDoc when behavior is not obvious
- Do not leave TODO or FIXME comments in completed features
- README examples must match real CLI output
- Every architectural deviation is recorded in `progress-tracker.md`
- Update `scanner-registry.md` immediately after a scanner is completed

---

## Dependency Policy

Before adding a dependency:

1. Confirm the feature is in v0.1 scope
2. Check whether Node or an approved dependency already provides it
3. Verify current official documentation and Node engine requirements
4. Record the reason in `library-docs.md`
5. Add it to the approved list below

Approved runtime dependencies:

- `@nestjs/common`
- `@nestjs/core`
- `nest-commander`
- `reflect-metadata`
- `rxjs`
- `execa`
- `dotenv`
- `chalk`
- `ora`

Approved development dependencies:

- `@nestjs/testing`
- `typescript`
- `vitest`
- `@types/node`
- ESLint packages selected during the scaffold

Do not install a web framework, database client, configuration framework, validation framework, terminal UI framework, or telemetry SDK in v0.1.

---

## Definition of Done for a Feature

A feature is complete only when:

- Implementation matches the context files
- Unit tests cover documented outcomes
- Relevant integration behavior is tested
- TypeScript build passes
- Test suite passes
- CLI output was manually smoke-tested when user-visible
- No Shipcheck-owned mutation of the scanned project occurs; verification accounts for expected repository-owned build/test script side effects
- No secret values appear in test output
- `scanner-registry.md` is updated when applicable
- `progress-tracker.md` is updated with the completed item and next item
