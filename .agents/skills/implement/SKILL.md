---
name: implement
description: Implement one ticket end to end and keep going until it is fully delivered: every acceptance criterion proven by a passing test, checks green, review fixed, docs updated, evidence recorded. Bugs found along the way are raised, not hidden.
disable-model-invocation: true
---

# Implement

Work exactly one ticket, in a fresh session. The ticket is not done until `gate deliver` passes.

## 1. Start

1. Call the Skill tool with `tickets`. Fetch the ticket (ask if ambiguous) and state its title. If the user described a change and no ticket covers it, follow "Request with no ticket" there: draft, confirm, write the ticket, then continue. If they change the requirements mid-way, follow "Requirements change mid-ticket": update this ticket and its log first.
2. `node .ai/cli/bin/cli.mjs gate implement --ticket <id>`. If blocked, stop and report.
3. Branch. Run `node .ai/cli/bin/cli.mjs branch show`. If a working branch is set, switch to it (stop and ask if the working tree has changes unrelated to this ticket; ticket-file edits carry over, never stash), then create the ticket branch from it, named by `node .ai/cli/bin/cli.mjs branch name <id>`, and do all the work there. If the working branch does not exist yet, say so and ask before creating it. If none is set, work on the current branch.
4. Claim it: status `in-progress`, progress log entry.
5. Read its inputs: spec, ADRs, designs, `GLOSSARY.md`, the relevant `.ai/maps/`.

## 2. Build, one criterion at a time

Call the Skill tool with `tdd`. For **every** acceptance criterion, in order:

1. Write a test whose name starts with the criterion ID: `cart/01#AC1 the item appears in the cart`. Test at the seam agreed in the spec.
2. Run it and see it fail for the right reason.
3. Write the smallest code that makes it pass. Run it.
4. Tick the criterion in the ticket (`- [x] AC1: ...`) only when its test passes.

A criterion that cannot be tested automatically (visual, copy, an external system) is the only exception: say why in the progress log and leave it for a `qa` ticket; never tick it without proof.

## 3. Prove it, and loop until it is perfect

Repeat until every line passes:

1. Run the verification commands in `AGENTS.md`: typecheck, the single test files often, then the **full suite**.
2. Call the Skill tool with `code-review` against the merge-base. Fix every finding at or above "should fix"; note the rest.
3. Call the Skill tool with `update-docs` for what this ticket changed.
4. Commit the code and tests with a conventional message: `<type>: <summary> [<ticket>]`, for example `feat: add export [orders/03]`. Type is one of `feat` (new behaviour), `fix` (bug), `refactor`, `test`, `docs`, `chore`; summary is short, imperative and lowercase. Do not commit the ticket file or `BOARD.md`; leave them for the user. Record Evidence: commit SHAs, test command and result, review summary, docs updated.
5. Run `node .ai/cli/bin/cli.mjs gate deliver --ticket <id>`. It checks: every criterion ticked, every criterion named by an automated test, no open blockers, Commits and Tests evidence present.

If anything fails, fix it and go round again. Never weaken an assertion, skip a test, or tick a criterion to get green. After **three full rounds** that still fail for the same reason, stop: write what is failing and why in the progress log, set `ready-for-human`.

When `gate deliver` passes: tick the remaining Evidence lines, set `in-review`, add a progress log entry, refresh the board. `done` means merged into the working branch: when the user says it is merged, or asks you to merge it, switch to the working branch, run `git merge --no-ff <ticket branch>`, record the merge commit in Evidence `PR:` as `merged into <working branch> (<sha>)`, set `done`, and refresh the board. On a conflict, stop and ask. Keep the ticket branch; offer to delete it. With no working branch set, `done` when the user merges without a PR.

## 4. Bugs found along the way

| You find | Do |
|---|---|
| A bug in the code you are writing for this ticket | Fix it. That is the normal red-green loop; no new ticket |
| An existing bug in code this ticket already touches, small and safe to fix | Fix it here **with its own regression test**, and add "Also fixed: ..." to the Evidence |
| An existing bug that **blocks** this ticket | Call the Skill tool with `report-bug` (`Found during: <this ticket>`), add the new bug to this ticket's `Blocked by`, log why, commit nothing broken, set this ticket to `ready-for-human`, stop |
| An existing bug **unrelated** to this ticket | Call the Skill tool with `report-bug` (`Found during: <this ticket>`, status `needs-triage`), add one line to the progress log, and carry on. Do not fix it |
| A security hole or data-loss risk | Call the Skill tool with `report-bug` with severity `S1`, set this ticket to `ready-for-human`, stop and tell the user. Never fix it quietly |

Unsure whether it is small? It is not: raise it.

## 5. Decisions

If you hit an unplanned, hard-to-reverse decision, stop, ask the user, and record it as an ADR with `domain-modeling`.
