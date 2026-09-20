# Progress Tracker

Update this file after every completed feature. Any engineer or AI agent reading it should immediately know what is complete, what is being worked on, and what comes next.

---

## Current Status

**Version:** v0.1.0

**Phase:** Phase 1 — Foundation

**In progress:** None

**Last completed:** Context filenames and scan side-effect documentation corrected

**Next:** 01 Project Scaffold

**Blockers:** None recorded

---

## Progress

### Phase 1 — Foundation

- [ ] 01 Project Scaffold
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
| TypeScript build           | Not started | —             |
| Unit tests                 | Not started | —             |
| Integration tests          | Not started | —             |
| Help/version smoke test    | Not started | —             |
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
Completed feature: Documentation cleanup; no implementation feature completed
Files changed: Eight context files renamed; overview, architecture, standards, registry, build plan, and tracker wording updated
Tests run and results: Direct file listing and text checks confirmed nine non-empty documents, matching context references, even code-fence counts, removal of the old blanket mutation guarantees, and 18 unchecked implementation features; application build/tests unavailable because scaffolding has not started
Manual verification: Side-effect wording aligned with AGENTS.md; mutation criteria distinguish Shipcheck-owned operations from repository-owned scripts
Verification limitation: Scripted reference/fence checks stalled and were replaced with direct file and text inspection; the cause of the scripted-check stall remains unconfirmed
Decision or deviation recorded: Documentation Cleanup entry added; no product-scope deviation
Next feature: 01 Project Scaffold
Known blocker: None
```
