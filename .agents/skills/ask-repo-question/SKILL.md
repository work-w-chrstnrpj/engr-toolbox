---
name: ask-repo-question
description: Answer questions about the repository without editing files. Use when the user asks how the codebase works, where behaviour lives, or what a change would affect.
---

# Ask Repo Question

## Steps

1. Read the cheap context first: `GLOSSARY.md`, then `.ai/context-routing.md` and the relevant `.ai/maps/` file, then `tickets/BOARD.md` if the question is about work in progress.
2. Search (`rg`, file search) for the exact files. Escalate to heavier context tools only per `use-context-tools`.
3. Read the exact files before claiming anything.
4. Answer directly, citing `file:line` for every claim.
5. If the answer reveals a bug or missing work, offer to create a ticket. A question alone needs no ticket.

## Boundaries

- Never edit, stage, commit or run destructive commands.
- Maps and summaries are navigation only; the code is the truth.
- Say plainly when evidence is missing.
