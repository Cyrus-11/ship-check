# CLI Output Tokens

Canonical terminal-output tokens for Shipcheck v0.1. These values replace visual UI design tokens. Every reporter decision must use these semantic tokens so output remains consistent, testable, and readable with or without color.

---

## How to Use

Define the tokens once in the reporter layer. Scanner services return semantic statuses and plain text; they never import Chalk, Ora, symbols, or spacing values.

```typescript
export const OUTPUT_SYMBOLS = {
  passed: "✓",
  failed: "✗",
  skipped: "○",
  error: "!",
} as const;

export const STATUS_LABELS = {
  READY: "READY",
  REVIEW: "REVIEW",
  NOT_READY: "NOT READY",
} as const;
```

Color is an enhancement, not information. Every state must remain distinguishable after ANSI escape sequences are removed.

---

## Semantic Color Tokens

| Token      | Chalk function | Used for                                      |
| ---------- | -------------- | --------------------------------------------- |
| `success`  | `chalk.green`  | Passed symbol, `READY`, passed gate           |
| `error`    | `chalk.red`    | Failed/error symbol, `NOT READY`, failed gate |
| `warning`  | `chalk.yellow` | Skipped symbol, `REVIEW`, caution text        |
| `info`     | `chalk.cyan`   | Product name and neutral highlights           |
| `muted`    | `chalk.dim`    | Paths, durations, secondary details           |
| `default`  | no transform   | Primary human-readable messages               |

Do not use background colors, 256-color codes, RGB values, gradients, blinking text, or animated color effects in v0.1.

---

## Status Symbols

| Result status | Symbol | Color     | Example                                  |
| ------------- | ------ | --------- | ---------------------------------------- |
| `passed`      | `✓`    | success   | `✓ Build        npm run build passed`    |
| `failed`      | `✗`    | error     | `✗ Tests        npm test failed`         |
| `skipped`     | `○`    | warning   | `○ Environment No .env.example found`    |
| `error`       | `!`    | error     | `! Git          Could not execute Git`   |

Symbols are always followed by one space. Status is never communicated by color alone.

---

## Text Labels

| Concept            | Exact label       |
| ------------------ | ----------------- |
| Product heading    | `Shipcheck vX.Y.Z`|
| Project name       | `Project:`        |
| Project path       | `Path:`           |
| Checks summary     | `Checks:`         |
| Readiness score    | `Release score:`  |
| Readiness status   | `Status:`         |
| Gate result        | `Release gate:`   |
| Passed gate value  | `PASSED`          |
| Failed gate value  | `FAILED`          |

The reporter must use these labels exactly. Stable wording makes snapshots, documentation, and CI logs dependable.

---

## Scanner Display Names

| Scanner ID | Display name  | Column width |
| ---------- | ------------- | -----------: |
| `git`      | `Git`         |           12 |
| `build`    | `Build`       |           12 |
| `test`     | `Tests`       |           12 |
| `env`      | `Environment` |           12 |

Use `padEnd(12)` for scanner names. Do not align output by adding tabs because tab width differs between terminals.

---

## Spacing Tokens

| Token                    | Value | Purpose                               |
| ------------------------ | ----: | ------------------------------------- |
| `headingGapLines`        |     1 | Blank line after heading              |
| `metadataGapLines`       |     1 | Blank line after project metadata     |
| `resultsGapLines`        |     1 | Blank line after scanner rows         |
| `scannerNameWidth`       |    12 | Fixed name column                     |
| `detailIndentSpaces`     |     2 | Indentation for optional detail lines |
| `maxVisibleDetails`      |     5 | Maximum detail lines per result       |
| `maxDetailLength`        |   160 | Maximum characters per detail line    |

Long detail text is truncated with `…`. Full captured build or test output is never printed in v0.1.

---

## Duration Tokens

Durations are secondary information and shown in muted text only when useful.

```text
under 1 second   → 342ms
1 second or more → 1.4s
```

Rules:

- Round millisecond values to a whole number
- Round seconds to one decimal place
- Never show minutes in v0.1; the command timeout is two minutes
- Do not include duration in stable scanner summary text used by tests; render it as a separate muted suffix

---

## Summary Grammar

The checks line follows this exact order:

```text
Checks: {passed} passed, {failedAndError} failed, {skipped} skipped
```

Examples:

```text
Checks: 4 passed, 0 failed, 0 skipped
Checks: 3 passed, 1 failed, 0 skipped
Checks: 3 passed, 0 failed, 1 skipped
```

Use `1 passed` and `1 failed` exactly; do not introduce singular alternatives. Stable grammar is preferred over linguistic variation in CLI output.

---

## Readiness Tokens

| Status      | Color   | Gate     | Meaning                                      |
| ----------- | ------- | -------- | -------------------------------------------- |
| `READY`     | success | `PASSED` | Score is at least 90                         |
| `REVIEW`    | warning | `FAILED` | Score is 70–89; human attention is required  |
| `NOT_READY` | error   | `FAILED` | Score is below 70                            |

The display value for internal `NOT_READY` is `NOT READY`.

---

## Spinner Tokens

Ora is allowed only while a local TTY scan is actively running.

| Moment                | Text                         |
| --------------------- | ---------------------------- |
| Before Git scanner    | `Checking Git state…`        |
| Before Build scanner  | `Running project build…`     |
| Before Test scanner   | `Running project tests…`     |
| Before Env scanner    | `Checking environment…`      |

Spinner output is disabled when any of these are true:

- `--ci` is present
- `process.stdout.isTTY !== true`
- `NO_COLOR` is set
- The reporter is under test

When disabled, do not print replacement progress lines. Print only final scanner rows.

---

## Color Capability

Color is enabled only when all conditions are satisfied:

```typescript
const colorEnabled =
  process.stdout.isTTY === true &&
  process.env.NO_COLOR === undefined &&
  options.ci !== true;
```

Tests must inject color capability instead of changing the developer's global terminal environment.

---

## Output Examples

### Ready

```text
Shipcheck v0.1.0

Project: xpress-api
Path: /workspace/xpress-api

✓ Git          Working tree is clean (main)
✓ Build        npm run build passed
✓ Tests        npm test passed
✓ Environment 8 required variables are present

Checks: 4 passed, 0 failed, 0 skipped
Release score: 100/100
Status: READY
Release gate: PASSED
```

### Review

```text
Shipcheck v0.1.0

Project: xpress-api
Path: /workspace/xpress-api

✓ Git          Working tree is clean (main)
✓ Build        npm run build passed
✗ Tests        npm test failed
✓ Environment 8 required variables are present

Checks: 3 passed, 1 failed, 0 skipped
Release score: 75/100
Status: REVIEW
Release gate: FAILED
```

### Environment Skipped

```text
Shipcheck v0.1.0

Project: worker-service
Path: /workspace/worker-service

✓ Git          Working tree is clean (main)
✓ Build        npm run build passed
✓ Tests        npm test passed
○ Environment No .env.example found

Checks: 3 passed, 0 failed, 1 skipped
Release score: 100/100
Status: READY
Release gate: PASSED
```

---

## Invariants

- Symbols and exact labels come from one reporter-owned constants file
- Scanner services return plain text only
- Color never carries meaning on its own
- No environment values are printed
- No file names from a dirty Git work tree are printed in v0.1
- No complete build or test output is printed in v0.1
- Scanner order and display-name alignment are stable
- CI and non-TTY output contain no spinner control characters
- Output remains understandable after ANSI codes are removed
- Any change to these tokens requires corresponding reporter snapshot updates
