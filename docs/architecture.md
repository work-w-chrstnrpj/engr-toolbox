# Architecture

> Status: COMPLETE

| Module | Responsibility | Code | ADRs (Architecture Decision Records) |
|---|---|---|---|
| CLI (command-line interface) | Parse commands and flags, print results, exit codes | `bin/cli.mjs` | |
| Config | Tiers (`extends`), role and skill metadata, install record | `lib/config.mjs` | |
| Install | Copy `.agents/` subset, scaffold, CLI copy; write `engr-toolbox.json` | `lib/install.mjs` | 0002, 0003 |
| Adapters | One generator per AI tool from the project's `.agents/` | `lib/generator.mjs` | 0003 |
| Safety | Managed headers; never overwrite project-owned files | `lib/safety.mjs` | 0003 |
| Tickets | Parse ticket files, frontier, board, status edits | `lib/tickets.mjs` | 0004 |
| Gates / validate / commits | Deterministic workflow checks | `lib/gates.mjs`, `lib/validator.mjs`, `lib/commits.mjs` | 0004 |
| Drift | Git diff since `.ai/last-sync` against map entries | `lib/drift.mjs` | |
| Loop | Unattended frontier runner with verify command and retry cap | `lib/loop.mjs` | 0004 |

## Data flow

`npx github:...` → `bin/cli.mjs init` → `install.mjs` copies `.agents/` + `template/` + `.ai/cli/` into the project → `generator.mjs` writes adapters from the project's `.agents/`. Afterwards everything runs from `.ai/cli/` inside the project against its own files.

## External systems

`git` (drift, commit checks). `gh` only through skills when the tracker is GitHub.

## Trust boundaries

The loop runs a user-supplied agent command and verify command through the shell; it never commits, pushes or merges itself.
