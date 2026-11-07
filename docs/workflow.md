# Workflow

**Rule: no work without a ticket, and every ticket ends with evidence.**

```text
adopt-project / ingest (once)
        ↓
grill-with-docs → design* → to-spec → to-tickets → implement (per ticket) → release-check → pr → retro
                                                    tdd → checks → code-review → update-docs → evidence
* design only when the team wants ERD, flows or API design approved first
```

## Which skill when

| You want to | Run |
|---|---|
| Onboard an existing repo | `/adopt-project` |
| Bring in a team document | `/ingest` |
| Shape an idea | `/grill-with-docs` |
| Produce ERD, flows, API changes | `/design` |
| Write the spec | `/to-spec` |
| Split into tickets | `/to-tickets` |
| Build one ticket | `/implement <feature/NN>` (fresh session per ticket) |
| Build many unattended | `engr loop --agent "claude -p" --verify "npm test"` |
| Sort incoming bugs and requests | `/triage` |
| Fix a hard bug | `diagnosing-bugs` |
| Review | `/code-review main` |
| Set up testing for the project | `/test-strategy` |
| Plan testing for a spec | `/test-plan` (after `/to-spec`) |
| Automate tests | `automate-tests` |
| Manual QA | `create-manual-test-cases`, `execute-manual-test-cases` |
| File a defect | `report-bug` |
| Flaky CI | `fix-flaky-tests` |
| Go/no-go | `test-report` |
| Release | `/cut-release` (gate, release-check, version, changelog, PR to main) |
| Set up CI/CD | `/setup-pipeline` or `engr pipeline` |
| Learn from it | `/retro` |
| Teammates changed code | `/update-docs` (uses `drift`) |
| Not sure | `/next` |
| Teach me / challenge me | `/mentor`, `/coach` |

QA and SDET details: `.agents/workflows/quality.md`.

## Ticket types and owners

| Type | Role | Typical skills |
|---|---|---|
| design | architect | design, grilling, domain-modeling |
| dev, bug | builder | implement, tdd, diagnosing-bugs |
| review | reviewer (read-only) | code-review |
| automation | sdet | test-strategy, test-plan, automate-tests, fix-flaky-tests, test-report |
| qa | qa | create/execute-manual-test-cases, report-bug |
| doc-drift | builder | update-docs |

## Where context lives

| What | Where | Who updates it |
|---|---|---|
| Terms | `GLOSSARY.md` | grill-with-docs, domain-modeling |
| Why (decisions) | `docs/adr/` | new ADR per decision; supersede, never rewrite |
| Team documents | `docs/inputs/` | ingest only; read-only |
| Designs | `docs/design/` | design |
| System as it is | `docs/api`, `docs/database`, `docs/deployment`, `docs/testing` | update-docs when a ticket lands |
| Where code is | `.ai/maps/` | update-docs, adopt-project, retro |
| Work and evidence | `tickets/`, `tickets/BOARD.md` | every skill, `status --write` |
| Test strategy, plans, cases, runs, traceability | `qa/` | sdet and qa; `trace`, `test-report` |

## Gates

| Before | Command | Blocks when |
|---|---|---|
| Spec | `gate spec` | AGENTS.md goal or stack missing, no glossary |
| Implement | `gate implement --ticket f/NN` | not ready, no criteria, open blockers |
| Ticket done | `gate deliver --ticket f/NN` | a criterion not ticked or not named by an automated test, open blockers, no Commits or Tests evidence |
| Release | `gate release --feature f` | any ticket open, done without evidence; with `qa/`: uncovered or failing criteria, red last run, open S1/S2 bug |
| Merge | `validate`, `sync --check`, `check-commits` | broken tickets, ADR links, map paths, adapter drift, commits without ticket |
