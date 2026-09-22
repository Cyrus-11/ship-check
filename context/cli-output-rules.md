# CLI Output Rules

Concise rules for building Shipcheck's terminal experience. These rules replace web UI rules. Terminal output is part of the public API: it must be stable, readable, safe, and suitable for both a developer's shell and CI logs.

---

## Output Order

Every completed scan uses this exact structure:

1. Product heading
2. Blank line
3. Project name
4. Project path
5. Blank line
6. Four scanner rows in registry order
7. Optional indented details directly below the related row
8. Blank line
9. Checks summary
10. Release score
11. Status
12. Release gate

Do not reorder sections based on pass or failure state.

---

## Streams

- Normal help, version, progress, scanner results, and completed reports go to `stdout`
- Fatal startup, invalid usage, and project-discovery errors go to `stderr`
- A scanner failure is part of a completed report, not a fatal CLI error; it stays on `stdout`
- Never use `console.log` throughout the codebase; the reporter receives explicit writer functions
- Bootstrap may write directly to `stderr` because the reporter may not exist yet

---

## Heading

Use one short heading:

```text
Shipcheck v0.1.0
```

Do not add an ASCII logo, box drawing, banner, slogan, or startup description in v0.1. Fast scan readability matters more than branding.

---

## Project Metadata

Always show:

```text
Project: {package name or directory basename}
Path: {absolute current working directory}
```

Rules:

- Never abbreviate the path
- Never display the contents of `package.json`
- Do not show package version, author, scripts, dependencies, or repository URL
- If `package.json.name` is absent, use the directory basename without warning

---

## Scanner Rows

Every scanner row follows:

```text
{symbol} {name padded to 12 characters} {summary}
```

Examples:

```text
✓ Git          Working tree is clean (main)
✗ Build        npm run build failed
○ Environment No .env.example found
```

Rules:

- Use spaces, never tabs
- Use the display names and symbols in `cli-output-tokens.md`
- Summary begins with an uppercase character and has no trailing period
- One row represents one scanner result
- Do not print internal scanner IDs
- Do not expose stack traces in a completed report

---

## Details

Details appear only when they help the developer act.

Allowed examples:

```text
✗ Environment Missing 2 required variables
  - DATABASE_URL
  - REDIS_URL
```

```text
✗ Build        npm run build timed out after 120s
```

Rules:

- Maximum five visible detail lines per scanner
- Prefix list items with two spaces, hyphen, and one space
- Truncate each line at 160 characters
- If more than five environment names are missing, show the first five and `- …and N more`
- Build and test command output is not rendered in v0.1
- Git changed paths are not rendered in v0.1; show only the changed-file count
- Environment values are forbidden in summaries and details

---

## Progress and Spinners

- Spinner use is optional presentation controlled only by `TerminalReporter`
- Use the text in `cli-output-tokens.md`
- Stop and clear the spinner before printing the final scanner row
- Never leave a spinner active while another scanner begins
- Disable spinners for CI, non-TTY output, tests, and `NO_COLOR`
- Scanner services must not create spinners

---

## Color

- Apply color after all plain text has been assembled
- Use semantic mappings from `cli-output-tokens.md`
- Disable color for `--ci`, non-TTY output, or `NO_COLOR`
- Do not include raw ANSI sequences in domain objects
- Do not force color through a CLI flag in v0.1
- Snapshot tests assert plain output by default

---

## Human-Readable Errors

Bootstrap/startup/execution/cleanup failures print `Shipcheck could not complete the command.` on stderr and select exit `2`. Invalid usage prints `Shipcheck received invalid arguments. Run shipcheck --help for usage.` on stderr and selects exit `2`. Both end with `\n`; neither includes raw arguments or internal error contents.

Fatal project-discovery errors use this pattern:

```text
Shipcheck could not scan this directory: package.json was not found.
Run the command from the root of a Node.js project.
```

The headline states the cause; the second line is always the same next action:

| Discovery failure                 | Headline                                                              |
| --------------------------------- | -------------------------------------------------------------------- |
| Missing `package.json`            | `Shipcheck could not scan this directory: package.json was not found.` |
| Invalid JSON or non-object root   | `Shipcheck could not scan this directory: package.json is not valid JSON.` |
| Unreadable `package.json`         | `Shipcheck could not scan this directory: package.json could not be read.` |

Rules:

- State what failed
- State the most useful next action when known
- Never print `error.stack` to users
- Never print serialized error objects
- Preserve the original error as an internal cause where supported
- Do not label a repository-owned build or test failure as an internal Shipcheck error

---

## Scanner Failure Language

Use these canonical summaries where applicable:

| Condition                         | Summary                                      |
| --------------------------------- | -------------------------------------------- |
| Not a Git repository              | `Not a Git repository`                       |
| Clean Git state                   | `Working tree is clean ({branch})`            |
| Dirty Git state                   | `Working tree has {count} changed files`      |
| Missing build script              | `package.json has no build script`            |
| Build passed                      | `npm run build passed`                        |
| Build non-zero                    | `npm run build failed`                        |
| Build timeout                     | `npm run build timed out after 120s`          |
| Missing test script               | `package.json has no test script`             |
| Tests passed                      | `npm test passed`                             |
| Tests non-zero                    | `npm test failed`                             |
| Test timeout                      | `npm test timed out after 120s`               |
| No environment contract           | `No .env.example found`                       |
| Environment passed                | `{count} required variables are present`      |
| Environment failed                | `Missing {count} required variables`          |
| Unexpected scanner failure        | `Scanner could not complete`                  |

For a count of one, use `1 required variable is present` and `Missing 1 required variable`.

---

## CI Behavior

`shipcheck scan --ci` changes presentation and exit enforcement, not scanner logic.

CI mode:

- Runs the same scanner registry and scoring algorithm
- Disables spinner and color
- Sets `CI=true` for the repository's test command
- Uses release status to select exit code
- Prints the complete report before setting `process.exitCode`

CI mode does not:

- Add scanners
- Change scanner weights
- Change score thresholds
- Hide skipped checks
- Emit JSON
- Upload results

---

## Help Output

Implementation sequencing: feature 02 supplied product help and version. Feature 03 registers `scan`, adds its help entry and `--ci`, and completes the help surface below. This sequencing adjustment was approved on 2026-09-20. The temporary scan shell produces no report and evaluates no checks; its local/CI exits are `0`/`1` until the pipeline is implemented. Completed-scan output rules apply once reporting is connected.

Help must communicate only the v0.1 surface:

Bare invocation prints root help on stdout and exits `0`. `-h` and `-V` are the help/version aliases. The implicit `help` subcommand is disabled.

```text
Usage: shipcheck [options] [command]

Check whether a Node.js project is ready to ship

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  scan [options]  Run release-readiness checks
```

The scan command exposes only:

```text
Usage: shipcheck scan [options]

Run release-readiness checks

Options:
  --ci        Enforce the release gate through process exit codes
  -h, --help  display help for command
```

Do not advertise roadmap features.

---

## Version Output

`shipcheck --version` prints the package version only:

```text
0.1.0
```

The version comes from package metadata or an injected build constant. It is never duplicated as a manually maintained literal across several files.

---

## Accessibility and Portability

- Do not rely on color alone
- Keep lines useful at an 80-column terminal width
- Use Unicode symbols but retain text labels that convey the same meaning
- Avoid emojis; their display width varies across terminals
- Normalize path display through Node's platform-aware path APIs
- Output newline is `\n`; Node handles terminal rendering
- Tests strip ANSI before asserting semantic content when color-specific behavior is under test

---

## Do Nots

- Do not create a web dashboard or terminal UI framework
- Do not clear the user's terminal
- Do not move the cursor outside Ora's controlled spinner behavior
- Do not prompt for input
- Do not print timestamps on every line
- Do not print command output continuously
- Do not print secret values
- Do not print Git file names
- Do not use icons or labels not defined in `cli-output-tokens.md`
- Do not change exit behavior from inside a scanner
- Do not use `process.exit()` for normal flow
- Do not add `--json`, `--verbose`, `--fix`, `--config`, or path arguments in v0.1

---

## Verification Checklist

Before a reporter change is complete, verify:

- Ready, review, not-ready, skipped, and error reports
- Color-enabled TTY rendering
- Plain non-TTY rendering
- `NO_COLOR` rendering
- CI rendering
- 80-column readability
- Correct stdout/stderr separation
- Report printed before exit code is set
- No secret or captured command output leakage
- Snapshot tests updated intentionally
