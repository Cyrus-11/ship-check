# Progress Tracker

Update this file after every completed feature. Any engineer or AI agent reading it should immediately know what is complete, what is being worked on, and what comes next.

---

## Current Status

**Version:** v0.1.0

**Phase:** Phase 1 — Foundation

**In progress:** None

**Last completed:** 01 Project Scaffold

**Next:** 02 Nest Standalone CLI Bootstrap

**Blockers:** None recorded

---

## Progress

### Phase 1 — Foundation

- [x] 01 Project Scaffold
- [ ] 02 Nest Standalone CLI Bootstrap
- [ ] 03 Scan Command Shell

### Phase 2 — Core Contracts and Infrastructure

- [ ] 04 Domain Contracts and Constants
- [ ] 05 Infrastructure Adapters
- [ ] 06 Project Discovery and Scan Context

### Phase 3 — Scanners

- [ ] 07 Git Scanner
- [ ] 08 Build Scanner
- [ ] 09 Test Scanner
- [ ] 10 Environment Scanner
- [ ] 11 Scanner Registry

### Phase 4 — Orchestration and Reporting

- [ ] 12 Scan Orchestration
- [ ] 13 Scoring Service
- [ ] 14 Terminal Reporter
- [ ] 15 CI Exit Enforcement

### Phase 5 — Verification and Packaging

- [ ] 16 Integration Fixture Suite
- [ ] 17 Executable and Package Smoke Test
- [ ] 18 Documentation and v0.1 Release Candidate

---

## Scanner Status

| Scanner     | Implementation | Unit tests | Integration coverage | Registry updated |
| ----------- | -------------- | ---------- | -------------------- | ---------------- |
| Git         | Not started    | Not started| Not started          | Not started      |
| Build       | Not started    | Not started| Not started          | Not started      |
| Tests       | Not started    | Not started| Not started          | Not started      |
| Environment | Not started    | Not started| Not started          | Not started      |

---

## Quality Gate Status

| Gate                       | Status      | Last verified |
| -------------------------- | ----------- | ------------- |
| TypeScript build           | Passed (scaffold) | 2026-09-20 |
| Unit tests                 | Passed (6 scaffold checks, including CLI smoke test) | 2026-09-20 |
| Integration tests          | Not started | —             |
| Help/version smoke test    | Basic help passed; product help/version pending feature 02 | 2026-09-20 |
| Local scan smoke test      | Not started | —             |
| CI exit-code smoke test    | Not started | —             |
| Package dry run            | Not started | —             |
| Secret-leak negative check | Not started | —             |
| Shipcheck-owned mutation check | Not started | —         |

---

## Decisions Made During Build

### Context Decisions

- Shipcheck v0.1 supports Node.js and TypeScript repositories using npm only
- NestJS is used as a standalone application context, never as an HTTP server
- `nest-commander` owns the command layer
- Node.js 22.12+ is required to align with the current Vitest engine requirement
- Native ESM and TypeScript NodeNext modules are used
- The public command surface is limited to help, version, `scan`, and `scan --ci`
- The scanner order is Git, Build, Tests, Environment
- Scanners run sequentially
- Each scanner has weight 25
- Skipped checks are excluded from the score denominator
- `READY` begins at 90; `REVIEW` begins at 70
- Only `READY` passes the release gate
- Local completed scans return exit code 0; CI enforces the gate
- Environment values and Git file paths are never printed
- Shipcheck-owned operations never modify the scanned repository; repository-owned build/test scripts may generate files or perform other side effects

Add implementation-time decisions below this line with date, reason, and affected files.

### Documentation Cleanup — 2026-09-20

- Renamed eight context files to remove the ` (1)` suffix and match the paths in `AGENTS.md` and internal references
- Clarified the side-effect boundary in the overview, architecture, code standards, scanner registry, build plan, and tracker to match `AGENTS.md`
- Updated mutation-check criteria to account for repository-owned build/test script side effects while keeping Shipcheck-owned operations read-only and committed fixture sources unchanged
- Documentation only; all 18 implementation features remain not started, with `01 Project Scaffold` next

### Scaffold Decisions — 2026-09-20

- Scope is feature 01 only; feature 02 CLI lifecycle/version integration and feature 03 scan command remain separate
- Selected Nest 11.2.5, nest-commander 3.21.0, TypeScript 5.9.3, Vitest 5.0.1, Execa 10.0.1, and Node 22 type definitions from npm metadata
- Initial installation with Nest 12 reported peer conflicts because nest-commander's discovery dependency requires Nest 11; corrected the manifest to Nest 11.2.5 before writing integration code. The final strict-peer install passed without warnings, the dependency tree resolves to one Nest version, and build/tests passed
- Keep the Node 22.12+ runtime baseline; development is currently on Node 24.16.0 with npm 11.13.0
- Compile tests with tsc before Vitest so constructor metadata is tested with the same decorator compiler settings as production
- User confirmed MIT licensing; package remains private because public npm publication is outside v0.1 scope
- Added strict NodeNext compiler configuration, shebang entry point, empty AppModule, compiled-test configuration, six scaffold checks, README, MIT license, and generated-artifact/environment-file ignores
- Verified scanner-registry.md still accurately lists all four scanners and their registry as not started; no scanner behavior changed
- Scoped review found no actionable issues in feature 01. Help currently renders the framework's basic `Usage: main [options]`; product naming, version handling, command registration, and complete exit/lifecycle behavior remain feature 02/03 work

---

## Deviations From Context

None.

If implementation must differ from the context pack:

1. Stop before making the conflicting change
2. Record the proposed deviation here
3. Explain why the current design cannot be followed
4. Update every affected context file after approval
5. Continue only when the documents are consistent again

---

## Notes

- Public npm publication is outside v0.1 implementation scope
- `npm pack --dry-run` and temporary local installation are required packaging checks
- New scanners, output formats, config files, and package managers belong to later versions
- Do not convert roadmap ideas into TODO comments in production code

---

## Session Handoff Template

Complete this section before ending an implementation session:

```text
Date:
Completed feature:
Files changed:
Tests run and results:
Manual verification:
Decision or deviation recorded:
Next feature:
Known blocker:
```

### Latest Handoff

```text
Date: 2026-09-20
Completed feature: 01 Project Scaffold
Files changed: package.json, package-lock.json, .gitignore, tsconfig*.json, vitest.config.ts, src/*, test/helpers/*, test/unit/scaffold.spec.ts, README.md, LICENSE, context/library-docs.md, context/architecture.md, context/progress-tracker.md
Tests run and results: npm install --no-audit --no-fund --strict-peer-deps passed without warnings on the final dependency set; npm test with NO_COLOR=1 passed production build, test compilation, and all 6 tests; git diff --check passed
Manual verification: node dist/main.js --help exited 0 with basic help and no Nest logs; dependency tree has compatible Nest 11 peers; tests verify shebang, package metadata, no emitted production tests, constructor DI and missing-dependency rejection, no network listener, and no HTTP platform adapter
Verification limits: Windows / Node 24.16.0 / npm 11.13.0 only; Node 22.12 and other OS execution not tested. Product help/version, scan behavior, and installed npm launcher/packaging checks remain in later features
Decision or deviation recorded: Scaffold Decisions and library compatibility note added; MIT confirmed by user; no product-scope deviation
Next feature: 02 Nest Standalone CLI Bootstrap
Known blocker: None
```
