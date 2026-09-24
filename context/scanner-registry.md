# Scanner Registry

Living document for every scanner included in Shipcheck. Read this before building or changing scanner behavior. The registry fixes scanner identity, order, weight, dependencies, and outcome rules so implementation cannot drift between sessions.

---

## How to Use

Before implementing a scanner:

1. Confirm the scanner exists in this registry
2. Read its algorithm in `architecture.md`
3. Read its canonical messages in `cli-output-rules.md`
4. Implement the shared `Scanner` contract
5. Add all required unit cases listed here
6. Update the implementation status below

Do not add a scanner to code without first adding it to the approved product scope. v0.1 contains exactly four scanners.

---

## Registry Order

| Order | ID      | Display name  | Weight | Provider       |
| ----: | ------- | ------------- | -----: | -------------- |
| 1     | `git`   | Git           | 25     | `GitScanner`   |
| 2     | `build` | Build         | 25     | `BuildScanner` |
| 3     | `test`  | Tests         | 25     | `TestScanner`  |
| 4     | `env`   | Environment   | 25     | `EnvScanner`   |

This order is injected through the `SCANNERS` token and is never discovered from the filesystem.

---

## Shared Contract

Every scanner:

- Is a Nest singleton provider
- Has an immutable ID, name, and weight
- Receives the shared `ScanContext`
- Returns exactly one `ScanResult`
- Measures its duration
- Catches expected operational failures and maps them to a status
- Never throws a repository-owned command failure
- Never formats terminal output
- Never sets a process exit code
- Never directly mutates the scanned project through Shipcheck-owned operations

Build and test scanners execute repository-owned scripts. Those scripts may generate files or perform other side effects; scanning does not sandbox them or guarantee they are read-only.

Unexpected exceptions are caught by `ScanService` as a final safety boundary and converted to `status: "error"`.

---

## Git Scanner

**Path:** `src/scanners/git/git.scanner.ts`

**Dependencies:** `ProcessRunner`, `Clock`

**Commands:**

```text
git rev-parse --is-inside-work-tree
git branch --show-current
git status --porcelain
```

**Pass condition:** Current directory is a Git work tree and porcelain output is empty.

**Fail conditions:**

- Git work-tree check returns non-zero
- Work tree contains any staged, unstaged, or untracked change

**Error conditions:**

- Git executable cannot be started
- An unexpected process adapter failure occurs

**Details policy:**

- Show branch name in the passing summary
- Use `detached HEAD` when the branch command returns an empty string
- Report dirty-file count only
- Do not return changed file paths in `details`

**Required unit cases:**

- Clean repository on named branch
- Clean repository in detached HEAD
- Dirty repository with staged change
- Dirty repository with unstaged change
- Dirty repository with untracked file
- Not a Git repository
- Git executable unavailable
- Duration recorded

**Implementation status:** Complete — `src/scanners/git/git.scanner.ts`, provided/exported by `src/scanners/scanners.module.ts`. Unit tests in `test/unit/scanners/git/git.scanner.spec.ts`; integration coverage in `test/integration/git-scanner.integration.spec.ts`.

---

## Build Scanner

**Path:** `src/scanners/build/build.scanner.ts`

**Dependencies:** `ProcessRunner`, `Clock`

**Command:**

```text
npm run build
```

**Timeout:** 120 seconds

**Pass condition:** `packageJson.scripts.build` exists and the command exits `0`.

**Fail conditions:**

- Build script is missing or blank
- Build command exits non-zero
- Build command times out
- Build output exceeds the capture limit (repo-owned failure, not a Shipcheck error)

**Error conditions:**

- npm executable cannot be started
- Unexpected process adapter failure

**Details policy:**

- No build output on success
- No full stdout/stderr on failure
- State timeout explicitly
- Captured output remains internal in v0.1

**Required unit cases:**

- Build script exists and passes
- Build script missing
- Build script blank
- Build exits non-zero
- Build times out
- Build output exceeds the capture limit
- npm executable unavailable
- `cwd` is the scan context directory
- Exact command and arguments passed without a shell
- Duration recorded

**Implementation status:** Complete — `src/scanners/build/build.scanner.ts`, provided/exported by `src/scanners/scanners.module.ts`. Unit tests in `test/unit/scanners/build/build.scanner.spec.ts`; integration coverage in `test/integration/build-scanner.integration.spec.ts`.

---

## Test Scanner

**Path:** `src/scanners/test/test.scanner.ts`

**Dependencies:** `ProcessRunner`, `Clock`

**Command:**

```text
npm test
```

**Environment override:**

```text
CI=true
```

**Timeout:** 120 seconds

**Pass condition:** `packageJson.scripts.test` exists and the command exits `0`.

**Fail conditions:**

- Test script is missing or blank
- Test command exits non-zero, including a no-tests failure chosen by the project's runner
- Test command times out

**Error conditions:**

- npm executable cannot be started
- Unexpected process adapter failure

**Details policy:**

- Do not infer framework-specific results
- Do not parse coverage
- Do not add Jest, Vitest, or other runner flags
- Do not render full test output

**Required unit cases:**

- Test script exists and passes
- Test script missing
- Test script blank
- Tests exit non-zero
- Tests time out
- npm executable unavailable
- Existing environment preserved while `CI=true` is added
- `cwd` is the scan context directory
- Duration recorded

**Implementation status:** Not started

---

## Environment Scanner

**Path:** `src/scanners/env/env.scanner.ts`

**Dependencies:** `FileSystem`, `Clock`, `dotenv`

**Input files:**

```text
.env.example  required names
.env          available names when present
.env.local    available names when present
process.env   available names
```

**Pass condition:** Every name declared by `.env.example` has a non-empty value in at least one available source.

**Fail conditions:** One or more declared names are absent or resolve to an empty string.

**Skip condition:** `.env.example` does not exist.

**Error conditions:**

- `.env.example` exists but cannot be read
- File parsing encounters an unexpected adapter failure

**Presence rule:**

A required name is present when at least one of `process.env`, `.env.local`, or `.env` supplies a non-empty value. The scanner does not construct a runtime configuration object, so value precedence is deliberately out of scope. Values are not retained in `ScanResult`.

**Details policy:**

- Return missing variable names only
- Sort missing names alphabetically for deterministic output
- Maximum five visible names is enforced by the reporter
- Never return available names or values
- Do not validate value format or compare against example placeholders

**Required unit cases:**

- `.env.example` absent → skipped
- All names supplied by `.env`
- All names supplied by `.env.local`
- All names supplied by `process.env`
- Names supplied across multiple sources
- Missing variable
- Empty variable value
- Comments and blank lines ignored
- Quoted values parsed
- Duplicate required names normalized
- Missing names sorted
- Values never appear in returned result
- Read failure becomes error
- Duration recorded

**Implementation status:** Not started

---

## Registry Provider

**Path:** `src/scanners/scanners.module.ts`

The module registers each concrete scanner and exposes one explicit ordered registry:

```typescript
{
  provide: SCANNERS,
  inject: [GitScanner, BuildScanner, TestScanner, EnvScanner],
  useFactory: (
    git: GitScanner,
    build: BuildScanner,
    test: TestScanner,
    env: EnvScanner,
  ): Scanner[] => [git, build, test, env],
}
```

**Required tests:**

- Registry contains exactly four scanners
- IDs are unique
- Order matches this document
- Weights are all 25
- Total configured weight is 100

**Implementation status:** Not started

---

## Scanner Addition Rule

No fifth scanner may be added in v0.1. A future scanner requires:

1. A version-scope decision
2. Project-overview update
3. Architecture and score-policy update
4. Registry entry
5. Output rules and canonical messages
6. Unit and integration cases
7. Build-plan update

This prevents an apparently small check from silently changing readiness scores or CI behavior.
