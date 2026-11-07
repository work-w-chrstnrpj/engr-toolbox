# Project Agent Rules

## Project Goal

Ship an installable, ticket-driven engineering workflow for AI coding agents: canonical skills and roles in `.agents/`, a project scaffold in `template/`, and a zero-dependency Node CLI that installs it (`npx --allow-git=all github:work-w-chrstnrpj/engr-toolbox`), generates adapters for 11 AI tools, and enforces the workflow with gates.

## Tech Stack

- Application/runtime: Node.js 18+ ES modules, no dependencies
- Service/API: not applicable
- Data store: not applicable (Markdown and JSON files)
- Testing: `node --test`
- Deployment: GitHub repository, installed with `npx github:` (no npm publish)

## Verification Commands

- Test: `npm test`
- Validate: `node bin/cli.mjs validate`
- Adapters current: `node bin/cli.mjs sync --check`
- Commit messages (CI checks them): `node bin/cli.mjs check-commits --range origin/main..HEAD`

## How We Work

This repo builds the toolbox; it does not track its own work in `tickets/`. Work on a branch, keep changes small, describe what changed and how it was verified in the PR, and add a `CHANGELOG.md` entry. Commits use `[no-ticket]`. The skills below are what projects get; read them, but the ticket rules apply to installed projects, not to this repo.


## Repository Map

| Path | What |
|---|---|
| `.agents/` | Canonical skills, roles, workflows, tool policies (installed into projects) |
| `template/` | Project scaffold copied by `init` (per tier in `preset.config.json`) |
| `bin/cli.mjs` | CLI entry point |
| `lib/` | Install, adapters, tickets, gates, drift, loop, validator |
| `tests/` | `node --test` suites |
| `docs/` | This tool's docs and ADRs |
| Tool folders (`.claude/`, `.cursor/`, `.github/agents`, ...) | Generated adapters. Never edit; run `node bin/cli.mjs sync --clean` |

## Rules

- Edit `.agents/` or `template/`, never generated adapters. Run `node bin/cli.mjs sync --clean` after changing `.agents/`.
- Skills in `.agents/` and files in `template/` must stay project-agnostic: no paths from this repo.
- Keep the CLI dependency-free and Node 18 compatible.
- A tier in `preset.config.json` must only list skills, roles and files that exist (tests enforce this).
- Never commit secrets. Ask before destructive git operations.

## Where Context Lives

`GLOSSARY.md`, `docs/adr/`, `.ai/context-routing.md`, `.ai/maps/`.
