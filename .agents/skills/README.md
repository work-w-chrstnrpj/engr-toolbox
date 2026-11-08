# Skills

**This file is the single source for "which skill when".** The `next` skill reads it, the docs link to it, and `discover skills` lists the descriptions. When you add, rename or remove a skill, update this file and nothing else.

Skills marked **you** run only when you type them (`/name`); they orchestrate. Skills marked **auto** can also be picked up by the agent when the task fits; they hold reusable discipline. A **you** skill may call **auto** skills, never another **you** skill. ★ = adapted from [Matt Pocock's skills](https://github.com/mattpocock/skills) (MIT, see `THIRD_PARTY_NOTICES.md`).

## Which skill when

### Main flow

| Where you are | Run |
|---|---|
| Existing repo, not onboarded yet (no `GLOSSARY.md` or maps) | `/adopt-project` |
| The team handed you documents (TDD (Technical Design Document), API (Application Programming Interface) spec, PRD (Product Requirements Document)) | `/ingest` |
| New idea or change | `/grill-with-docs` ★ |
| Idea is clear, the team wants ERD (Entity Relationship Diagram), flows or API design first | `/design` |
| Idea or design is clear | `/to-spec` ★ |
| Spec exists, project has `qa/`, no test plan yet | `/test-plan` |
| Spec (and test plan) exist, no tickets | `/to-tickets` ★ |
| Tickets are ready | `/implement <ticket>` ★ (fresh session each), `/cook-a-ticket [taste-test-review-serve] <ticket>` (build in steps you pick, uncommitted until `serve`), `/implement-spec` ★ (all in parallel), or `/cli loop` (unattended) |
| Automation tickets are ready | `automate-tests` |
| QA (Quality Assurance) tickets are ready | `manual-testing` |
| Tickets are `in-review` | `code-review` ★, then merge |
| A feature is done, ready to ship a version | `/cut-release` |
| After a feature or a bad session | `/retro` ★ |

### Side roads

| Situation | Run |
|---|---|
| Unsure what to do next | `/next` |
| Unsure which skill or flow fits, want the options explained | `/ask-engr` ★ |
| Want to see what is installed, or run a workflow command | `cli` (`/cli status`, `/cli discover skills`) |
| Incoming bugs or requests from others | `/triage` ★ |
| Something is broken and the cause is not obvious | `diagnosing-bugs` ★ |
| A test, run or user found a defect | `report-bug` |
| CI (Continuous Integration) is unreliable, tests fail intermittently | `fix-flaky-tests` |
| An incident needs a formal report | `generate-rca` |
| Teammates changed code outside the AI | `update-docs` (uses `drift`) |
| Set up or change CI/CD (Continuous Integration and Continuous Delivery), different steps per branch | `/setup-pipeline` |
| Project has no test strategy yet (`qa/` exists) | `/test-strategy` |
| Go/no-go numbers for a feature | `test-report` |
| A huge, unclear effort | `/wayfinder` ★ |
| The codebase feels tangled | `/improve-codebase-architecture` ★ |
| A design question needs running code | `prototype` ★ |
| You need an answer from another person | `/to-questionnaire` ★ |
| A question about the code, no changes | `ask-repo-question` |
| A question about docs, specs or APIs outside the repo, findings saved to a file | `research` ★ |
| Moving work to another tool or person | `/handoff` ★ |
| Didn't understand a message, or want teaching | `/mentor` (`/mentor that` re-explains the last message) |
| Want critique | `/coach` |

## All skills

| Skill | What it does | Invoked by | Owner |
|---|---|---|---|
| `adopt-project` | Onboard an existing repo: glossary, ADRs (Architecture Decision Records), architecture, maps | you | architect |
| `ingest` | Bring a team document into `docs/inputs/` and extract terms, decisions, questions | you | architect |
| `grill-with-docs` ★ | Brainstorm by interview, recording terms and decisions | you | all |
| `design` | ERD, flows, API changes for a design ticket | you | architect |
| `to-spec` ★ | Turn the conversation into a spec | you | architect |
| `test-strategy` | Pyramid, tools, environments, CI stages, quality gates (once) | you | sdet |
| `test-plan` | Risk-based plan per spec; lists qa and automation tickets | you | sdet, qa |
| `to-tickets` ★ | Thin end-to-end tickets with blockers | you | architect |
| `triage` ★ | Move incoming issues through the ticket states | you | all |
| `implement` ★ | One ticket to full delivery: tests per criterion, checks, review, docs, evidence | you | builder |
| `cook-a-ticket` | Make a ticket's code change, then add what you want with modifiers: `taste` (summary), `test`, `review`, `serve` (validate, commit with an optional gist, close the ticket), `season` (change the ticket in hand) | you | builder |
| `implement-spec` ★ | All tickets of a spec in parallel on one branch | you | builder |
| `automate-tests` | UI (user interface), API, contract and integration automation traced to criteria | auto | sdet |
| `manual-testing` | Write and run manual cases with evidence | auto | qa |
| `report-bug` | Reproducible bug ticket with severity | auto | all |
| `fix-flaky-tests` | Quarantine, diagnose and fix flaky tests | auto | sdet |
| `test-report` | Go/no-go report from results, traceability and bugs | auto | sdet |
| `code-review` ★ | Standards and spec review in parallel | auto | reviewer |
| `cut-release` | Gate, checks, version, changelog, PR to main | you | all |
| `setup-pipeline` | Design and write the CI/CD pipeline per branch | you | sdet, builder |
| `pr` ★ | Pull request (PR) body | auto | all |
| `retro` ★ | Retrospective: improve the environment after a session | you | all |
| `tickets` | Ticket format, states, evidence rule | auto | all |
| `grilling` ★ | Interview until every decision is made | auto | all |
| `tdd` ★ | Test-driven development: red-green loop at agreed seams | auto | builder, sdet |
| `diagnosing-bugs` ★ | Feedback loop first, then fix | auto | builder, qa |
| `domain-modeling` ★ | Glossary and ADRs | auto | architect |
| `codebase-design` ★ | Deep modules and seams | auto | architect, builder |
| `prototype` ★ | Throwaway code for one question | auto | architect, builder |
| `update-docs` | Keep facts current, flag decisions | auto | builder |
| `ask-repo-question` | Answer questions, no edits | auto | all |
| `research` ★ | Investigate primary sources, save cited findings to a file | auto | all |
| `use-context-tools` | When to use heavier context tools | auto | all |
| `generate-rca` | Formal RCA (Root Cause Analysis) from a finished investigation | auto | qa, builder |
| `cli` | Run workflow commands, discover what is installed, regenerate tool files | auto | all |
| `next` | Read the board and this table, give the one next step | you | all |
| `ask-engr` ★ | Router: which skill or flow fits, and the flows explained | you | all |
| `wayfinder` ★ | Map a huge, unclear effort as decision tickets | you | architect |
| `improve-codebase-architecture` ★ | Find deepening opportunities | you | architect |
| `handoff` ★ | Portable summary for another tool or person | you | all |
| `to-questionnaire` ★ | Questions for someone else to answer | you | architect |
| `mentor` | Teaching style; re-explain the last message | you | all |
| `coach` | Critique style | you | all |

## Adding a skill

Only add one when it is a repeatable step with clear inputs, steps and output that existing skills cannot compose. Domain checklists belong in role playbooks. Add it to the two tables above and to a tier in `preset.config.json`.
