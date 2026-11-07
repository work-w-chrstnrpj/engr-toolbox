# Guide: using engr-toolbox

From install to release, with one example feature (**Add to cart**) followed all the way through.

**Contents:** [Key ideas](#key-ideas) · [1. Install](#1-install) · [2. Onboard](#2-onboard) · [3. One feature, start to finish](#3-one-feature-start-to-finish) · [4. Day to day by role](#4-day-to-day-by-role) · [5. Working in a team](#5-working-in-a-team) · [6. Claude Code, Codex or terminal](#6-claude-code-codex-or-terminal) · [7. CI/CD](#7-cicd-optional) · [8. Unattended loop](#8-unattended-loop) · [9. Customising](#9-customising) · [10. FAQ](#10-faq)

---

## Key ideas

Five words you will see everywhere:

| Word | Meaning |
|---|---|
| **Ticket** | One unit of work: a file in `tickets/<feature>/NN-<slug>.md` with a type, a status, blockers, acceptance criteria, a progress log and evidence |
| **Acceptance criterion** | One testable condition on a ticket, numbered `AC1`, `AC2`. Tests refer to it as `cart/01#AC1` |
| **Evidence** | Proof the work is done: commits, tests run, review notes, docs updated. A ticket cannot be `done` without it |
| **Gate** | A check the CLI (command-line interface) runs before a phase: can I start this ticket, can I ship this feature |
| **Skill** | One reusable step the agent runs, like `/to-spec` or `/implement` |

---

## 1. Install

```bash
npx --allow-git=all github:work-w-chrstnrpj/engr-toolbox
```

Every install question, the sizes, project vs global, the short `engr` command and upgrading are in **[Getting started](getting-started.md)**. Commit what was installed; teammates get the same setup by pulling.

---

## 2. Onboard

Do this once. Open the project in your AI tool.

**Existing codebase:**

```text
/adopt-project
```

The agent reads your code and docs, then writes `GLOSSARY.md`, ADRs (Architecture Decision Records) for decisions already in the code, `docs/architecture.md`, and the maps in `.ai/maps/`. Nothing of yours is deleted.

**The team handed you documents** (TDD (Technical Design Document), API (Application Programming Interface) spec, PRD (Product Requirements Document)):

```text
/ingest ~/Downloads/payments-team/          # a whole folder
/ingest tdd-v2.pdf api.yaml erd.png         # or several files
```

The agent previews every file as new, changed or unchanged, then copies the new and changed ones into `docs/inputs/<team>/` (read-only), keeping the folder's structure. A changed file keeps its previous version beside it with the date (`tdd.2026-11-07.md`), and every file gets a row in `docs/inputs/INDEX.md`. It then reads each one, adds terms to the glossary and decisions as ADRs, and lists contradictions and open questions for you, grouped by owner. Run it again when the team sends updates: only what changed is ingested.

Terminal version: `engr inputs scan <folder> --to payments` to preview, `engr inputs add <folder> --to payments --owner "Payments team"` to copy, `engr inputs` to list.

**New project:** fill the goal, tech stack and verification commands in `AGENTS.md`.

**QA (Quality Assurance) setup**, medium and large sizes. The SDET (Software Development Engineer in Test) does this once:

```text
/test-strategy
```

You get `qa/strategy.md`: test pyramid, tools, environments, CI (Continuous Integration) stages and quality gates.

---

## 3. One feature, start to finish

Example: users can add items to a cart.

### Step 1 · Brainstorm, all roles

```text
/grill-with-docs I want users to add items to a cart
```

The agent asks questions in rounds, each with a recommended answer. QA and SDET ask *"how will we test this?"*. New terms land in `GLOSSARY.md`, hard decisions in `docs/adr/`.

### Step 2 · Design, architect (if the team wants to see it first)

```text
/design
```

You get `docs/design/cart/erd.md`, `flow-add-to-cart.md` and `api-changes.md` (Mermaid diagrams), reviewed in a PR (pull request). Dev tickets wait for this approval.

### Step 3 · Spec, architect

```text
/to-spec
```

`tickets/cart/spec.md`: problem, solution, user stories, decisions, and the **test seams** (where tests go).

### Step 4 · Test plan, SDET and QA

```text
/test-plan
```

`qa/plans/cart.md`: risks scored by likelihood × impact, what is automated, what is manual, entry and exit criteria, and the QA and automation tickets needed.

### Step 5 · Tickets, architect

```text
/to-tickets
```

One file per ticket, thin slices that each work end to end:

```markdown
# 01: Add an item to the cart

**Type:** dev
**Status:** ready-for-agent
**Blocked by:** None

## Acceptance criteria
- [ ] AC1: the item appears in the cart
- [ ] AC2: the cart total updates

## Evidence
- Commits:
- Tests:
- Review:
- Docs updated:

## Progress log
```

Plus `02-automate-cart.md` (type `automation`, blocked by 01) and `03-qa-cart.md` (type `qa`, blocked by 01). See the board:

```text
/cli status
```

### Step 6 · Build, builder

Start a **fresh session** for each ticket, then:

```text
/implement cart/01
```

The agent checks the gate, claims the ticket, then for **every** acceptance criterion writes a failing test named after it (`cart/01#AC1 ...`), makes it pass and ticks it. It runs the full suite, reviews its own diff, updates docs, commits with `cart/01` in the message and records evidence, then runs `gate deliver`. It keeps going round until that passes (every criterion tested and ticked, evidence recorded) and only then sets `in-review`.

**Bugs found along the way:** bugs in its own new code it simply fixes. Small existing bugs in code it touches it fixes with their own regression test and notes in the evidence. Anything else it files with `report-bug` (`Found during: cart/01`, status `needs-triage`) and carries on, unless the bug blocks the ticket or is a security or data-loss risk: then it stops and hands the ticket to you.

### Step 7 · Automate, SDET

```text
/automate-tests cart/02
```

UI (user interface) or API tests for each criterion, run three times to catch flakes, results recorded:

```bash
engr test-report --junit results/ --feature cart --ticket cart/02 --write
```

### Step 8 · Manual testing, QA

```text
/manual-testing cart/03
```

Cases in `qa/cases/cart/`, each with `Covers: cart/01#AC2`. Results in `qa/runs/` (pass, fail, blocked, not run). Every failure:

```text
/report-bug
```

A bug ticket with severity S1 to S4, steps, expected and actual. The builder fixes it with `/implement`, QA re-runs.

### Step 9 · Review, reviewer

```text
/code-review main
```

Two reviews in parallel: does it follow our standards, and does it do what the ticket asked? Findings go into the ticket's evidence.

### Step 10 · Ready to ship?

```text
/cli trace --feature cart
/test-report
/cli gate release --feature cart
```

`trace` shows each criterion with its tests and cases. `test-report` writes a GO or NO-GO report. The gate blocks if any ticket is open, any done ticket lacks evidence, any criterion is untested or failing, or an S1/S2 bug is open.

### Step 11 · Release and learn

```text
/cut-release
/retro
```

`/cut-release` runs the release gate, the test report and your checks, reviews the diff and rollback plan, proposes the next version, writes the `CHANGELOG.md` section from the done tickets, bumps the version and opens the PR to main. With the pipeline in `release` mode, merging it tests and publishes (GitHub Release, npm or Docker). Without the pipeline, it tells you the tag to push. `/retro` turns what went wrong into new checks or rules for next time.

---

## 4. Day to day by role

| Role | Typical day |
|---|---|
| 🏛️ architect | `/grill-with-docs`, `/design`, `/to-spec`, `/to-tickets`; `/ingest` new team docs (whole folders are fine); record decisions as ADRs |
| 🔨 builder | `/cli status`, then `/implement <ticket>` in a fresh session; `diagnosing-bugs` for hard bugs |
| 🔍 reviewer | `/code-review main` on each PR; read-only, never edits |
| 🧪 qa | `/manual-testing`, exploratory sessions, `/report-bug`, re-tests |
| 🤖 sdet | `/test-plan` per spec, `/automate-tests`, `engr test-report --junit ... --write`, `/fix-flaky-tests`, `/test-report` before release |

Everyone shares the same tickets, criteria, glossary, ADRs and designs. Each role writes to its own area: code (builder), `qa/cases` and `qa/runs` (qa), the automation suite and `qa/flaky.md` (sdet).

---

## 5. Working in a team

**After pulling teammates' changes:**

```bash
engr drift
```

It lists what changed since your last sync, which maps point at those files, and which reference docs may be stale. Then:

```text
/update-docs
```

Facts (maps, API and data docs) are fixed directly. Decisions are drafted as `proposed` ADRs for the author to confirm, inside a `doc-drift` ticket. Finally `engr drift --mark`.

**Commits** always name their ticket: `feat: add to cart [cart/01]`. Use `[no-ticket]` only for trivial housekeeping.

**CI/CD (Continuous Integration and Continuous Delivery):** see [section 7](#7-cicd-optional).

**Incoming bugs and requests** from others: `/triage`.

---

## 6. Claude Code, Codex or terminal

| You want to | Claude Code | Codex | Terminal |
|---|---|---|---|
| Run a skill | `/to-spec` | Skills menu, or "run the to-spec skill" | n/a |
| Use a role | "use the sdet agent to ..." | "act as the sdet agent" | n/a |
| See the board | `/cli status` or "show the board" | "show the board" | `engr status` |
| See what exists | `/cli discover skills` | "what skills do we have?" | `engr --help-discover-skillset` |
| Explain simply | `/mentor ELI5 what is a gate?` · `/mentor that` (re-explain) | "explain like I'm 5: ..." | n/a |
| Unsure what's next | `/next` | "run the next skill" | `engr status` |

Everything is stored in files, so you can switch tools mid-feature: write the spec in Claude Code, implement in Codex. The ticket's progress log tells the next agent where things stand.

---

## 7. CI/CD (optional)

**Easiest:** run `/setup-pipeline` in your AI tool. It asks what each branch should run (for example: feature → develop only tests; develop → main tests, build, tag and npm) and writes the YAML for you.

**Quick defaults:** answer question 6 during install, or any time later:

```bash
engr pipeline --mode test --write                                  # tests on every PR and push to develop
engr pipeline --mode release --release-targets release,npm --write   # also release on merge to main
engr pipeline --provider gitlab --mode release --write              # GitLab CI instead of GitHub Actions
engr pipeline --dev-branch none --write                              # feature → main, no develop branch
engr pipeline --mode none --write                                    # switch it off (removes the generated workflows)
```

It writes `.github/workflows/engr-checks.yml` and `engr-release.yml` (GitHub) or `.gitlab-ci.yml` (GitLab). A PR (GitLab: merge request) runs checks before code lands; a merge is the code landing, where releases run. Every PR runs install, test, build, `validate`, `sync --check` and the commit ticket check. A merge to main releases `v<version>` only when that tag doesn't exist yet. Details: `.agents/workflows/release.md`, or run `/setup-pipeline` and the agent walks you through it.

---

## 8. Unattended loop

Let an agent work through ready tickets while you are away, with brakes:

```bash
engr loop --dry-run --verify "npm test"
engr loop --agent "claude -p" --verify "npm test" --max-tickets 3
```

For each ready ticket it claims it, runs the agent on `/implement`, then runs your verify command **and** `gate deliver`. Only a fully delivered ticket (tests green, every criterion tested and ticked, evidence recorded) moves to `in-review`. Otherwise it retries up to 3 times, telling the agent exactly what is still missing, then sets `ready-for-human` and stops. Bugs the agent files along the way are listed at the end of the run; they wait for `/triage`, and an `S1` stops the loop. It never pushes or merges. Start with `--max-tickets 1` and review every PR.

---

## 9. Customising

- **Change a skill or role:** edit it in `.agents/`, then `engr sync`. Never edit the copies in `.claude/`, `.cursor/` and so on.
- **Keep your own version of a generated file:** delete its `Generated by engr-toolbox` line. Sync and upgrades will leave it alone.
- **Upgrade, change size, tools or scope, uninstall:** see [Getting started](getting-started.md#4-upgrade-change-remove).

---

## 10. FAQ

**Do I have to use every skill?**
No. Small changes can go straight to `/implement`. The gates only check what matters: tickets, evidence, tests.

**What if the team's TDD and our design disagree?**
The team's document is the stated intent. Disagreeing needs an ADR approved by the document's owner. `/ingest` lists contradictions for you.

**A decision changed. Do I edit the ADR?**
No. Write a new ADR that supersedes it; the old one only gets its status changed. History stays.

**The gate says a criterion is not covered.**
Add a test whose name contains the criterion ID (`cart/01#AC2 ...`), or a manual case with `Covers: cart/01#AC2`. Then run `engr trace` again.

**I see `kept N file(s) without the generated header` after sync.**
Those files are treated as yours. Delete them to get the generated version back, or run `sync --force`.

**Where do I start when I'm lost?**
`/next`. It reads the board and tells you the one next step.
