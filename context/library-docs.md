# Library Docs

Project-specific usage patterns for every third-party library in Shipcheck v0.1. This file describes how the project uses each library; it is not a replacement for official documentation.

Official documentation was checked on 2026-09-20. Library APIs and engine requirements can change, so verify the installed version before implementing a section.

---

## Before Using Any Library

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
import { CommandFactory } from "nest-commander";

import { AppModule } from "./app.module.js";
import { readPackageVersion } from "./common/package-version.js";

async function bootstrap(): Promise<void> {
  await CommandFactory.run(AppModule, {
    cliName: "shipcheck",
    version: await readPackageVersion(),
    usePlugins: false,
    errorHandler: (error: Error): void => {
      process.stderr.write(`Shipcheck failed to start: ${error.message}\n`);
      process.exitCode = 2;
    },
  });
}

void bootstrap();
```

The `version` option enables the global `-V, --version` flag. `usePlugins` is explicitly false because plugins are outside v0.1.

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

Confirm the exact boolean option-parser behavior with the installed version and its types.

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

### Adapter Pattern

```typescript
import { execa } from "execa";

export class ProcessRunner {
  public async run(request: ProcessRequest): Promise<ProcessResult> {
    try {
      const result = await execa(request.file, request.args, {
        cwd: request.cwd,
        env: request.env,
        timeout: request.timeoutMs,
        reject: false,
        maxBuffer: 1_000_000,
      });

      return {
        exitCode: result.exitCode ?? 1,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
      };
    } catch (error: unknown) {
      throw new ProcessStartError(request.file, { cause: error });
    }
  }
}
```

This is the intended mapping, not a promise that every property name is identical across Execa majors. Confirm against installed types.

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
    include: ["test/**/*.spec.ts"],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
  },
});
```

### Rules

- Use Node test environment
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
