# Workflow

**Rule: no work without a ticket, and every ticket ends with evidence.**

```text
adopt-project / ingest (once)
        ↓
grill-with-docs → design* → to-spec → to-tickets → implement (per ticket) → cut-release → retro
                                                    tdd → checks → code-review → update-docs → evidence
* design only when the team wants ERD, flows or API design approved first
```

## Which skill when

One table, kept in one place: **[.agents/skills/README.md](../.agents/skills/README.md#which-skill-when)**. In your AI tool, `/next` reads it together with the ticket board and tells you the one next step; `/cli discover skills` lists what is installed.

QA and SDET details: `.agents/workflows/quality.md`. Releasing: `.agents/workflows/release.md`.

## Ticket types and owners

| Type | Role | Typical skills |
|---|---|---|
| design | architect | design, grilling, domain-modeling |
| dev, bug | builder | implement, tdd, diagnosing-bugs |
| review | reviewer (read-only) | code-review |
| automation | sdet | test-strategy, test-plan, automate-tests, fix-flaky-tests, test-report |
| qa | qa | manual-testing, report-bug |
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
