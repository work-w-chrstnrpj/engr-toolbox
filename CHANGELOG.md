# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-11-08

Adds a human-in-the-loop way to build a ticket, and a defined commit format for `implement`.

### Added

- `cook-a-ticket` skill: makes a ticket's code change without committing, with combinable modifiers `[taste-test-review-serve]` (`serve` commits with an optional `gist:` in the message body and closes the ticket) and a follow-up `[season]` that changes the ticket in hand. Added to the `scenarios` workflow as the human-in-the-loop path.

### Changed

- `implement` names the commit message format (`<type>: <summary> [<ticket>]` with `feat`, `fix`, `refactor`, `test`, `docs`, `chore`) and leaves the ticket file and `BOARD.md` uncommitted.

## [0.1.0] - 2026-11-08

First release of engr-toolbox: a ticket-driven engineering workflow for AI coding agents. Skills and roles the agent runs, a fixed project structure, and a zero-dependency Node CLI that checks the rules instead of hoping the agent follows them.

### Install

Requires Node 18 or newer and git. Works with Claude Code, Codex, Cursor, OpenCode, Antigravity, GitHub Copilot, Windsurf, Cline, Kilo, Aider and OpenHands.

```bash
# latest
npx --allow-git=all github:work-w-chrstnrpj/engr-toolbox

# exactly this version
npx --allow-git=all github:work-w-chrstnrpj/engr-toolbox#v0.1.0 init --yes
```

Pick a size when asked: `small` (solo: tickets, test-first build, review, glossary, ADRs), `medium` (adds the team and design layer), or `large` (adds QA and SDET automation). Choices are saved in `engr-toolbox.json` and re-used on upgrade.

### Quick start

1. **New project:** `/grill-with-docs` → `/design` (if data or APIs are involved) → `/to-spec` → `/to-tickets` → `/implement` per ticket → `/cut-release`.
2. **Existing repo:** `/adopt-project`, then the same flow for each change. Team handed you documents: `/ingest`.
3. **Huge or foggy effort:** `/wayfinder` first.
4. **Lost?** `/next` gives the one next step; `/ask-engr` says which skill fits; the `scenarios` workflow lists the recommended flow for each situation.

### What is included

- **42 skills and 5 roles** (architect, builder, reviewer, QA, SDET); roles become subagents where the tool supports them.
- **Ticket system:** local files (or GitHub Issues), states, numbered acceptance criteria, blockers, evidence, and a generated board.
- **Gates** for spec, implement, deliver and release. `gate deliver` needs every criterion ticked, named by a passing test, with evidence recorded. `implement` loops until that holds.
- **Ticket guard:** in Claude Code, source edits are blocked and prompts get a reminder while no ticket is in progress; a `commit-msg` git hook requires a ticket reference or `[no-ticket]`. A request with no ticket is ticketed first; a mid-ticket requirement change edits that ticket and logs it. Set `ENGR_GUARD=warn` or `off` to relax.
- **Context that stays true:** `GLOSSARY.md`, ADRs, maps, `drift` and `update-docs` for teammates' changes, `/ingest` for team documents.
- **CLI:** `init`, `update`, `sync`, `status`, `gate`, `trace`, `drift`, `validate`, `check-commits`, `loop`, `inputs`, `discover`, `pipeline`, `test-report`, `guard`.
- **Optional CI/CD** pipeline generation for GitHub Actions or GitLab CI.

### Upgrade

```bash
engr update --check   # installed vs latest, exit 1 when behind
engr update           # upgrade, keeping your saved choices and any file you edited
```

`status` and `validate` also warn once a day when your install is behind (off with `ENGR_NO_UPDATE_CHECK=1`).

### Known limits

- Edit blocking works in Claude Code only; other tools rely on the written rules, gates and CI.
- The ticket guard hooks are tested in isolation, not yet observed firing inside a live Claude Code session.
- `update --check` compares against the version on `main`; unreleased changes there can show as an available update. Selecting a version with `update --to` is not available yet.
