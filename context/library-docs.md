# Library Docs

Project-specific usage patterns for every third-party library in Shipcheck v0.1. This file describes how the project uses each library; it is not a replacement for official documentation.

Official documentation was checked on 2026-09-20. Library APIs and engine requirements can change, so verify the installed version before implementing a section.

---

## Before Using Any Library

### Scaffold Dependency Selection — 2026-09-20

The feature 01 manifest pins Nest common/core/testing 11.2.5, nest-commander 3.21.0, reflect-metadata 0.2.2, RxJS 7.8.2, Execa 10.0.1, TypeScript 5.9.3, Vitest 5.0.1, and @types/node 22.20.4. Versions and engine/peer ranges were checked through npm metadata before installation. The lockfile records the resolved dependency tree.

Compatibility finding: nest-commander 3.21.0 accepts Nest 12 in its own peer range, but its @golevelup/nestjs-discovery 7.0.3 dependency requires Nest common/core `^11.1.21`. The initial Nest 12 install produced peer warnings, so all Nest packages were changed to 11.2.5 before integration code was written. No engine baseline or product-scope change is required.

TypeScript 5.9 is selected for the documented legacy-decorator/NodeNext toolchain. Tests will be compiled with tsc into `.test-dist/` before Vitest runs the emitted JavaScript; production output remains in `dist/`. This avoids relying on a test transform to emit Nest constructor metadata. Execa is installed now for compiled-executable smoke tests and later belongs behind the production ProcessRunner adapter. Test harnesses may use Execa and Node filesystem APIs directly to inspect and execute compiled artifacts; production adapter boundaries are unchanged.

Verification: the final `npm install --no-audit --no-fund --strict-peer-deps` completed without warnings on Windows with Node 24.16.0/npm 11.13.0. `npm test` with `NO_COLOR=1` passed the production build, test compilation, and six scaffold checks, including constructor injection and rejection of a missing dependency. The CLI help smoke test uses the production `dist/main.js`.

The remaining approved runtime libraries (dotenv, Chalk, Ora) will be installed when their features are implemented. No lint or coverage script is exposed until its tooling is configured. nest-commander brings its own transitive command, discovery, configuration, and prompt dependencies; these do not authorize separate application layers or interactive product features.

Vitest 5.0.1 declares Node `^22.12.0 || ^24.0.0 || >=26.0.0`. The product runtime baseline remains `>=22.12.0`; contributors must use a Node version supported by the test runner, such as Node 22.12+ on the 22.x line or Node 24.x.

### Library Integration Checklist

Before implementing a feature that touches a third-party package:

1. Read `AGENTS.md` for project-specific tooling or skills
2. Inspect the installed package version in `package.json` and the lockfile
3. Read the official documentation for that exact major version
4. Read the relevant section in this file
5. Follow the stricter Shipcheck rule when general documentation offers several patterns

Order of authority:

```text
Current project context → installed-version official docs → package types → general knowledge
```

Do not copy a web-server NestJS pattern into this CLI merely because it is common in tutorials.

---

## Node.js

**Project baseline:** Node.js 22.12 or newer.

This baseline satisfies the current Vitest engine requirement documented when this context pack was created. Declare it in `package.json`:

```json
{
  "engines": {
    "node": ">=22.12.0"
  }
}
```

### Built-ins Used

| Module              | Use                                                        |
| ------------------- | ---------------------------------------------------------- |
| `node:path`         | Safe absolute path construction and directory basename     |
| `node:fs/promises`  | Read-only file access behind `FileSystem`                   |
| `node:os`           | Temporary directory parent in tests                        |
| `node:url`          | ESM path conversion only when package-relative files needed|
| `node:process`      | cwd, env reads, stdout/stderr, exit code                    |

### Rules

- Import built-ins with the `node:` prefix
- Never use sync filesystem APIs in runtime services
- Do not use `child_process` directly; all process execution goes through Execa in `ProcessRunner`
- Do not mutate `process.env`
- Use `process.exitCode`, never `process.exit()`
- Treat `process.cwd()` as user input and resolve it once

---

## NestJS Standalone Application

**Official docs:** <https://docs.nestjs.com/standalone-applications>

NestJS can create an application context without network listeners. Shipcheck uses that provider container model and does not create a web application.

`nest-commander` owns the application-context bootstrap in the final design, so do not call both `NestFactory.createApplicationContext()` and `CommandFactory.run()` for the same execution.

### App Module

```typescript
import { Module } from "@nestjs/common";

import { CommandsModule } from "./commands/commands.module.js";

@Module({
  imports: [CommandsModule],
})
export class AppModule {}
```

### Provider Pattern

```typescript
import { Injectable } from "@nestjs/common";

@Injectable()
export class ScoringService {
  public calculate(results: ScanResult[]): ScoreResult {
    // pure scoring logic
  }
}
```

### Rules

- `@nestjs/common` and `@nestjs/core` are runtime dependencies
- `reflect-metadata` is imported once at the executable entry point
- `rxjs` remains a Nest peer/runtime dependency but is not used for scanner orchestration
- Modules expose only providers needed by downstream modules
- No platform adapter package
- No controllers
- No Nest HTTP logger noise in terminal output

---

## nest-commander

**Official docs:**

- <https://nest-commander.jaymcdoniel.dev/en/features/factory/>
- <https://nest-commander.jaymcdoniel.dev/en/features/commander/>
- <https://nest-commander.jaymcdoniel.dev/en/api/>

`nest-commander` turns Nest providers into command runners and manages the application lifecycle.

### Bootstrap

```typescript
#!/usr/bin/env node

import "reflect-metadata";

import { bootstrap } from "./bootstrap.js";

void bootstrap();
```

The implementation is in `src/bootstrap.ts`. The factory's `version` option enables global `-V, --version`; `usePlugins: false`, `logger: false`, and `abortOnError: false` disable plugin discovery and Nest logs and allow startup rejection to reach the safe error boundary.

Verified against nest-commander 3.21.0 and its Commander 11.1.0 dependency during feature 02:

- `cliName` alone does not control displayed usage. `@RootCommand({ name: "shipcheck", description: ... })` supplies that metadata through `CommandsModule`.
- The root provider configures its framework-owned command through `setCommand`, rejecting excess arguments and disabling the implicit `help` subcommand. Bare invocation prints help. Feature 03 adds a separate `ScanCommand` provider.
- The `errorHandler` option becomes Commander's exit override. It must throw the parser signal; merely setting `process.exitCode` and returning still permits `process.exit()`.
- Feature 02's `serviceErrorHandler` recognized the exact root signal captured by the override. Feature 03 uses a shared `throwParserExit` helper for root and child overrides: it throws a project-owned `ParserExitSignal`, and the service handler recognizes only that wrapper. Other exceptions propagate to the outer safe boundary, including command errors that merely resemble a help signal. Default error serialization is never used.
- `CommandFactory.run()` awaits application close after parsing/execution. Parser exit codes are applied afterward; a failed close selects exit `2` even if version output already succeeded. Startup rejection occurs before the factory obtains a context it can close.
- The `outputError` hook replaces parser diagnostics with a stable usage hint, preventing raw argument/error text from appearing in output.
- Package version comes from a package-relative dynamic JSON import with `{ with: { type: "json" } }`, supported by the Node 22.12+ baseline. The loader validates a non-empty string and does not inspect the target project's manifest.

Verification: production/test TypeScript builds and all 38 tests passed on Windows / Node 24.16.0, including native subprocess lifecycle, error, and metadata cases. Vitest's in-process data-URL import path dropped JSON import attributes during the initial metadata tests (`ERR_IMPORT_ATTRIBUTE_MISSING`), so those cases now run the production loader in native Node subprocesses. Do not replace the runtime JSON loader to accommodate a different test import path.

### Scan Command

```typescript
import { Command, CommandRunner, Option } from "nest-commander";

type ScanCommandOptions = {
  ci?: boolean;
};

@Command({
  name: "scan",
  description: "Run release-readiness checks",
})
export class ScanCommand extends CommandRunner {
  public constructor(private readonly scanService: ScanService) {
    super();
  }

  public async run(
    _inputs: string[],
    options: ScanCommandOptions,
  ): Promise<void> {
    const report = await this.scanService.scan({ ci: options.ci === true });
    process.exitCode = selectExitCode(report, options.ci === true);
  }

  @Option({
    flags: "--ci",
    description: "Enforce the release gate through process exit codes",
  })
  public parseCi(): boolean {
    return true;
  }
}
```

Feature 03 checked the installed 3.21.0 source/types and Commander 11.1.0. A value-free `--ci` invokes its parser, which returns `true`; absent options normalize to `false`. No environment binding or option default is needed. Compiled CLI coverage exercises option forwarding rather than only calling the parser method directly.

The snippet above shows delegation only. The implementation also overrides `setCommand()` to call `allowExcessArguments(false)` and `exitOverride(throwParserExit)` on the child. nest-commander independently constructs commands and attaches them with `addCommand()`, so these root settings are not inherited. Its `allowExcessArgs` metadata only enables the setting when truthy; `false` does not disable Commander's permissive default. Factory output configuration is applied to each command, preserving safe child diagnostics. The temporary `ScanService` returns a failed gate until real checks exist and does not render a report.

### Rules

- Commands are providers registered in a module reachable from `AppModule`
- Commands contain no scanner logic
- `scan` is not the implicit root command in v0.1; the explicit form is `shipcheck scan`
- Only `--ci` is defined on `scan`
- Global version comes from package metadata
- Default Nest startup logging remains disabled
- Do not use `runWithoutClosing`; Shipcheck is not a watch process
- Do not enable plugins or interactive questions

---

## Execa

**Official repository/docs:** <https://github.com/sindresorhus/execa>

Execa is used only inside `ProcessRunner`. Current Execa is ESM-first, which is why Shipcheck uses NodeNext modules.

### Implemented Adapter — Feature 05

Installed Execa 10.0.1 was checked against its exported types, source, and versioned [Windows](https://github.com/sindresorhus/execa/blob/v10.0.1/docs/windows.md), [errors](https://github.com/sindresorhus/execa/blob/v10.0.1/docs/errors.md), and [termination](https://github.com/sindresorhus/execa/blob/v10.0.1/docs/termination.md) documentation. No dependency change was needed.

ProcessRunner validates an absolute cwd, separate executable/argument values, environment overrides, and an integer timeout in Node's supported 1–2,147,483,647 ms range. It snapshots the inherited environment, applies overrides (undefined removes a key), normalizes Windows key casing, and sets extendEnv:false. It never mutates process.env or adds CI itself.

Invocation uses shell:false, reject:false, preferLocal:false, stdin:ignore, captured stdout/stderr, encoding:buffer, buffer:true, stripFinalNewline:false, verbose:none, windowsHide:true, cleanup:true, killDescendants:true, and forceKillAfterDelay:5000. The 1,000,000-byte cap is per stream: Execa's text encoding counts characters, so byte capture is decoded only for ProcessResult. Captured output and raw causes remain private.

Windows lookup uses FileSystem before launch: otherwise a missing command can fall through to cmd.exe and appear as ordinary exit 1. Native .exe/.com files and the resolved npm.cmd launcher are supported. The user approved Execa's internal cmd.exe launcher for npm.cmd; Shipcheck never constructs a shell command. Arbitrary shebang/batch launchers and App Execution Aliases that deny metadata access fail safely. PATH/PATHEXT order, quoted directories, current-directory control, and case-insensitive environment keys are explicit. No direct dependency on Execa's transitive lookup library is added.

Failure mapping checks start errors and output-limit/I/O errors before timeouts, signals, and numeric exits. Missing commands/cwd and start failures throw ProcessStartError. Invalid requests, output limits, signals/cancellation, and unexpected adapter failures throw ProcessExecutionError with a safe reason and fixed message. An output-limit failure remains an error even with exitCode 0. Timeouts return timedOut:true and synthetic exitCode 1; ordinary non-zero child exits are returned unchanged. Never use an unconditional exitCode fallback or label every caught exception a start failure.

Execa's descendant cleanup is best-effort (process groups on POSIX; taskkill on Windows). Grace time and OS scheduling can extend the timeout; escaped descendants and total subprocess memory are not contained. If Windows denies taskkill, Execa can kill only the direct process and inherited descendant pipes may delay settlement. Native process-tree verification requires normal process-management permissions. No raw cause, stack, arguments, or output belongs in public diagnostics.

### Rules

- Pass `file` and `args` separately
- Never use the `$` tagged template API in production scanner code
- Never set `shell: true`
- Always set `cwd`
- Always set a timeout
- Use `reject: false` for expected non-zero child exits
- Keep stdout/stderr captured
- Maximum buffer is 1 MB per stream
- Do not pipe build or test output directly to the user's terminal
- Convert Execa-specific results into the project-owned `ProcessResult`
- Execa types must not leak beyond `ProcessRunner`

---

## dotenv

**Official repository/docs:** <https://github.com/motdotla/dotenv>

Shipcheck parses environment files without loading them into the CLI process.

### Correct Pattern

```typescript
import { parse } from "dotenv";

const parsed = parse(fileContent);
```

### Forbidden Pattern

```typescript
import "dotenv/config";
// or
dotenv.config({ path: scannedProjectPath });
```

Loading the scanned repository's values into `process.env` would mix user application state with Shipcheck's own process and make tests unpredictable.

### Presence Evaluation

```typescript
function isPresent(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}
```

### Rules

- Parse string content already read through `FileSystem`
- Required names come only from `.env.example`
- Available values may come from `.env`, `.env.local`, or `process.env`
- Normalize duplicate required names
- Sort missing names alphabetically
- Discard values after presence evaluation
- Never place parsed objects in logs or results
- Do not expand nested variables in v0.1
- Do not support custom env file paths in v0.1

---

## Chalk

**Official repository/docs:** <https://github.com/chalk/chalk>

Chalk is used only by `TerminalReporter` to apply semantic color after plain lines are assembled.

```typescript
import chalk from "chalk";

const rendered = colorEnabled ? chalk.green("✓") : "✓";
```

### Rules

- Use the semantic map in `cli-output-tokens.md`
- Never import Chalk in scanners, scoring, or command services
- Do not force a color level globally
- Respect non-TTY output and `NO_COLOR`
- CI output is plain
- Do not use background colors or custom RGB values
- Tests inject color capability and strip ANSI only in color-specific cases

---

## Ora

**Official repository/docs:** <https://github.com/sindresorhus/ora>

Ora provides temporary progress feedback for local interactive terminals.

```typescript
import ora from "ora";

const spinner = ora({
  text: "Running project build…",
  isEnabled: spinnerEnabled,
});

spinner.start();
try {
  return await operation();
} finally {
  spinner.stop();
}
```

### Rules

- Only `TerminalReporter` creates a spinner
- Disable for CI, non-TTY output, tests, and `NO_COLOR`
- Stop and clear before printing a final result row
- Do not use `succeed()` or `fail()` to print scanner rows; the reporter owns final rows separately
- Only one spinner may exist at a time
- No custom spinner frames in v0.1

---

## Vitest

**Official docs:** <https://vitest.dev/guide/>

The current Vitest documentation requires Node.js 22.12 or newer. Shipcheck therefore sets Node 22.12 as its minimum runtime rather than relying on an older test-runner release.

### Package Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

Add a coverage provider only when the coverage script is implemented; do not leave a broken script in the scaffold.

### Config Intent

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [".test-dist/test/**/*.spec.js"],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
  },
});
```

### Rules

- Use Node test environment
- Compile source and tests through `tsconfig.test.json` before Vitest; `npm test` does this automatically through `pretest`, using the same decorator options as the production build
- Use `vitest run` in CI and the package test script
- Keep unit tests isolated from real Git and npm processes
- Integration tests may spawn the compiled Shipcheck CLI
- Reset environment mutations after every test
- Avoid global test APIs; import from `vitest`
- Do not use browser mode or Vitest UI
- No network tests
- Reporter snapshots use stable plain output

---

## @nestjs/testing

**Official docs:** <https://docs.nestjs.com/fundamentals/testing>

Use Nest's testing module only when dependency injection behavior is part of the test. Pure scoring helpers can be instantiated directly.

```typescript
const moduleRef = await Test.createTestingModule({
  providers: [GitScanner, ProcessRunnerMock, ClockMock],
})
  .overrideProvider(ProcessRunner)
  .useValue(processRunner)
  .compile();

const scanner = moduleRef.get(GitScanner);
```

### Rules

- Override collaborators at provider boundaries
- Do not test private methods directly
- Close compiled modules after tests when lifecycle hooks exist
- Do not bootstrap the entire application for a scanner unit test
- Command integration tests may use `nest-commander` testing utilities if they reduce process-level complexity; compiled CLI tests remain required for public exit behavior

---

## TypeScript Compiler

**Official docs:** <https://www.typescriptlang.org/tsconfig>

Feature 04 uses the installed TypeScript 5.9.3 with no compiler or dependency change. Domain contracts use type-only imports, a scanner ID union derived with `typeof SCAN_ORDER`, and `as const satisfies Record<ScannerId, number>` for policy coverage. `Object.freeze` protects the flat policy objects and tuple at runtime. The shell service and exit selector use `Pick<ScanReport, "gatePassed">` while complete reports await orchestration. Context/package readonly fields protect typed consumers but do not validate untrusted JSON or deep-freeze runtime objects.

The definitions for `Pick`, `Record`, `Readonly`, and `Object.freeze` were inspected in installed `lib.es5.d.ts`, alongside official [utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html), [typeof types](https://www.typescriptlang.org/docs/handbook/2/typeof-types.html), and [satisfies](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html) documentation. Compiler-only positive/negative examples live in `test/typechecks/domain-contracts.ts`, included by the existing test tsconfig. Their uncalled function is never executed by Vitest; explained `@ts-expect-error` directives fail compilation if the expected rejection disappears.

### Runtime Config

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`tsconfig.build.json` excludes `test`, `dist`, and coverage artifacts.

### Rules

- Use `tsc` as the production build in v0.1
- Do not introduce SWC, webpack, tsup, or esbuild
- Keep the executable shebang as the first line in `src/main.ts`; verify the compiled file preserves it
- Never emit test files into `dist`
- Build output must run directly with Node

---

## npm Packaging

Shipcheck v0.1 is structured as an installable CLI even though public npm publication is outside the build scope.

```json
{
  "name": "shipcheck",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "shipcheck": "./dist/main.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=22.12.0"
  }
}
```

### Local Executable Verification

```bash
npm run build
npm link
shipcheck --version
shipcheck --help
```

For a repeatable packaging smoke test, prefer `npm pack --dry-run` and inspect the file list. Do not publish from the implementation workflow.

### Rules

- Package version is the single version source
- `bin` points to compiled JavaScript
- `dist/main.js` begins with a Node shebang
- Include only distributable files
- Lockfile is committed
- npm is the only scanned-project package manager supported in v0.1
- Do not add install-time or postinstall scripts

---

## Git CLI

**Official docs:** <https://git-scm.com/docs>

Git is an external prerequisite for the Git scanner, not an npm dependency.

Commands are invoked exactly as argument arrays:

```typescript
await processRunner.run({
  file: "git",
  args: ["status", "--porcelain"],
  cwd: context.cwd,
  timeoutMs: 10_000,
});
```

### Rules

- Never use shell command strings
- Do not run commands that modify Git state
- No `git add`, `commit`, `checkout`, `reset`, `clean`, `stash`, or fetch
- Do not contact remotes
- Treat all porcelain lines as changed entries
- Do not display changed paths in v0.1
- Git timeout is 10 seconds per command

---

## Approved Dependency Map

| Package             | Runtime/dev | Used by                               |
| ------------------- | ----------- | ------------------------------------- |
| `@nestjs/common`    | Runtime     | Modules, providers, decorators        |
| `@nestjs/core`      | Runtime     | Nest application context              |
| `nest-commander`    | Runtime     | Commands, help, version, lifecycle    |
| `reflect-metadata`  | Runtime     | Decorator metadata bootstrap          |
| `rxjs`              | Runtime     | Nest peer dependency                  |
| `execa`             | Runtime     | ProcessRunner                         |
| `dotenv`            | Runtime     | Environment-file parsing              |
| `chalk`             | Runtime     | TerminalReporter colors               |
| `ora`               | Runtime     | Local TTY spinner                     |
| `@nestjs/testing`   | Dev         | DI-focused unit tests                 |
| `typescript`        | Dev         | Compilation                           |
| `vitest`            | Dev         | Test runner                           |
| `@types/node`       | Dev         | Node types                            |
| ESLint packages     | Dev         | Static analysis selected at scaffold  |

Any package not listed here needs a documented scope decision before installation.

---

## Explicitly Rejected for v0.1

- `@nestjs/platform-express` and `@nestjs/platform-fastify`
- `commander` as a separately used application layer; `nest-commander` owns it
- `@nestjs/config`; no Shipcheck configuration file exists yet
- `zod`; there is no external config schema or JSON reporter in v0.1
- YAML libraries
- Inquirer or prompt libraries
- Terminal UI frameworks
- Logging frameworks such as Winston or Pino
- Database clients
- HTTP clients
- Telemetry SDKs
- Security scanners

Rejecting these dependencies keeps v0.1 focused; it does not decide later versions.
