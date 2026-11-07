# Skills

Each skill is one reusable step. Skills marked **you** run only when you type them (`/name`); they orchestrate. Skills marked **auto** can also be picked up by the agent when the task fits; they hold reusable discipline. A **you** skill may call **auto** skills, never another **you** skill.

Adapted from [Matt Pocock's skills](https://github.com/mattpocock/skills) (MIT) where noted with ★. See `THIRD_PARTY_NOTICES.md`.

## Main flow

| Step | Skill | Invoked by |
|---|---|---|
| Onboard an existing repo | `adopt-project` | you |
| Bring in team documents | `ingest` | you |
| Brainstorm | `grill-with-docs` ★ | you |
| Design (ERD, flows, API) | `design` | you |
| Spec | `to-spec` ★ | you |
| Tickets | `to-tickets` ★ | you |
| Build one ticket | `implement` ★ | you |
| Build a whole spec in parallel | `implement-spec` ★ | you |
| Triage incoming work | `triage` ★ | you |
| Release | `release-check`, `pr` ★ | auto |
| Retrospective | `retro` ★ | you |
| What now? | `next` | you |
| Run a workflow command for me | `cli` (`/cli status`, `/cli gate release --feature cart`) | auto |
| What exists? | `discover` (`/discover skills`, `roles`, `workflows`, `docs`, `structure`) | auto |

## Disciplines

| Skill | Purpose | Invoked by |
|---|---|---|
| `tickets` | Ticket format, states, evidence rule | auto |
| `grilling` ★ | Interview until every decision is made | auto |
| `tdd` ★ | Red-green loop at agreed seams | auto |
| `code-review` ★ | Standards and spec review in parallel | auto |
| `diagnosing-bugs` ★ | Feedback loop first, then fix | auto |
| `domain-modeling` ★ | Glossary and ADRs | auto |
| `codebase-design` ★ | Deep modules, seams | auto |
| `prototype` ★ | Throwaway code for one question | auto |
| `update-docs` | Keep facts current, flag decisions | auto |
| `ask-repo-question` | Answer questions, no edits | auto |
| `use-context-tools` | When to use heavier context tools | auto |
| `generate-rca` | Formal RCA from a finished investigation | auto |
| `sync-ai-adapters` | Regenerate tool adapters | auto |

## Quality (QA and SDET)

| Skill | Purpose | Invoked by | Owner |
|---|---|---|---|
| `test-strategy` | Pyramid, tools, environments, CI stages, quality gates (once) | you | sdet |
| `test-plan` | Risk-based plan per spec; creates qa and automation tickets | you | sdet, qa |
| `automate-tests` | UI, API, contract and integration automation traced to criteria | auto | sdet |
| `fix-flaky-tests` | Quarantine, diagnose and fix flaky tests | auto | sdet |
| `test-report` | Go/no-go report from results, traceability and bugs | auto | sdet |
| `report-bug` | Reproducible bug ticket with severity | auto | qa, sdet |
| `create-manual-test-cases` | Manual cases in `qa/cases/` | auto | qa |
| `execute-manual-test-cases` | Manual runs in `qa/runs/` with evidence | auto | qa |

## Helpers

| Skill | Purpose | Invoked by |
|---|---|---|
| `wayfinder` ★ | Map a huge, unclear effort as decision tickets | you |
| `improve-codebase-architecture` ★ | Find deepening opportunities | you |
| `handoff` ★ | Portable summary for another tool or person | you |
| `to-questionnaire` ★ | Questions for someone else to answer | you |
| `wait-what` ★ | Re-explain a confusing message | you |
| `mentor` | Teaching style | you |
| `coach` | Critique style | you |

## Adding a skill

Only add one when it is a repeatable step with clear inputs, steps and output that existing skills cannot compose. Domain checklists belong in role playbooks.
