# Project Agent Rules

## Project Goal

[State the project goal here.]

## Tech Stack

- Application/runtime: [Runtime or framework]
- Service/API: [Runtime, framework, or not applicable]
- Data store: [Data store or not applicable]
- Testing: [Test tools]
- Deployment: [Deployment target]

## Verification Commands

- Lint: `[lint command]`
- Typecheck: `[typecheck command]`
- Test: `[test command]`
- Build: `[build command]`

## How We Work

All work happens on a ticket and every ticket ends with evidence. Start with `/next` if unsure; see everything available with `/cli discover`; run any workflow command with `/cli` (terminal: `engr <command>` or `node .ai/cli/bin/cli.mjs <command>`).

```text
grill-with-docs → design (if needed) → to-spec → to-tickets → implement (per ticket) → cut-release → retro
```

- Existing repo, first time: `/adopt-project`. Team handed you documents: `/ingest`.
- Asked to implement something with no ticket? Create the ticket first (draft, confirm, write, then proceed); see the `tickets` skill. Requirements change mid-ticket? Edit that ticket and log the change, then change the code.
- One ticket per session. Claim it, log progress, reference its ID in every commit.
- A ticket closes only with evidence (commits, tests, review, docs updated).
- After pulling teammates' changes: `update-docs` (uses `drift`).
- Acceptance criteria are numbered `AC1`, `AC2`; tests and manual cases name the criterion they prove (`cart/01#AC1`).

## Where Context Lives

| What | Where |
|---|---|
| Terms | `GLOSSARY.md` |
| Decisions (why) | `docs/adr/` |
| Architecture overview | `docs/architecture.md` |
| Team documents (read-only) | `docs/inputs/` |
| Designs (ERD (Entity Relationship Diagram), flows, API (Application Programming Interface) changes) | `docs/design/` |
| Current system reference | `docs/api/`, `docs/database/`, `docs/deployment/`, `docs/testing/` |
| Where code lives | `.ai/maps/`, `.ai/context-routing.md` |
| Work and evidence | `tickets/`, `tickets/BOARD.md` |
| Test strategy, plans, cases, runs, traceability | `qa/` (medium and large) |
| Ticket tracker setup | `docs/agents/issue-tracker.md` |

## Rules

- The code is the truth; maps and summaries are for navigation only. Read exact files before editing.
- Never edit `docs/inputs/`. Never rewrite an accepted ADR (Architecture Decision Record); supersede it.
- Small, reviewable changes inside the ticket's scope. Run verification before claiming success.
- Ask before destructive, production, secret, or migration operations. No force-push or history rewrites without approval.
- Never commit secrets or log sensitive data. Validate input at trust boundaries.

## AI Structure

Canonical assets in `.agents/` (skills, roles, workflows, tool policies). Tool folders are generated: edit `.agents/`, then run `node .ai/cli/bin/cli.mjs sync`.
