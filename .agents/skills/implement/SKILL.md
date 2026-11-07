---
name: implement
description: Implement one ticket end to end: claim it, build test-first, run checks, review, update docs, record evidence.
disable-model-invocation: true
---

# Implement

Work exactly one ticket. Start from a fresh session per ticket.

## Steps

1. Call the Skill tool with `tickets`. Fetch the ticket the user named (ask if ambiguous) and state its title.
2. Run `node .ai/cli/bin/cli.mjs gate implement --ticket <id>`. If it fails (blocked, missing acceptance criteria, wrong state), stop and report.
3. Claim it: status `in-progress`, add a progress log entry.
4. Read its inputs: spec, ADRs, designs, `GLOSSARY.md`, the relevant `.ai/maps/`.
5. Call the Skill tool with `tdd` and build at the seams agreed in the spec. Run typecheck and single test files often, the full suite once at the end. Use the verification commands in `AGENTS.md`.
6. If you hit an unplanned decision that is hard to reverse, stop, ask the user, and record an ADR with `domain-modeling`.
7. Call the Skill tool with `code-review` against the branch's merge-base. Fix what it finds.
8. Call the Skill tool with `update-docs` for anything this ticket changed (maps, reference docs, glossary).
9. Commit to the current branch with the ticket ID in the message.
10. Fill the ticket's Evidence (commit SHAs, test command and result, review summary, docs updated), tick acceptance criteria, set status `in-review` (or `done` if the user merges without PR), add a progress log entry, refresh the board.
