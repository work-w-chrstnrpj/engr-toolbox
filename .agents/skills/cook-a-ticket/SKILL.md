---
name: cook-a-ticket
description: Execute the code change from a ticket, uncommitted, and add what you want with modifiers like [taste-test-review-serve]. Taste summarizes, test writes and runs tests, review calls code-review, serve validates the criteria, commits (with an optional gist) and closes the ticket, season changes the ticket you are working on.
disable-model-invocation: true
---

# Cook a ticket

Cook is the code change from a ticket and nothing more. Modifiers add the rest. Combine them in square brackets:

```text
/cook-a-ticket [taste-test-review] orders/03
/cook-a-ticket [season] the export should also include totals
/cook-a-ticket orders/03                    (cook only)
/cook-a-ticket [test-serve] orders/03 gist: empty carts export a header only
```

Read the modifiers from the brackets. A leading dash, hyphens, spaces or commas between them all mean the same: `[taste-test]`, `[-taste -test]`, `[taste, test]`. Unknown word: say so and ask. The rest of the request is the ticket (or, with `season`, the change).

## Cook (always)

1. Call the Skill tool with `tickets`. Fetch the ticket (ask if ambiguous), state its title, set it `in-progress`, add a progress log entry.
2. Read what it relies on: its Inputs, `GLOSSARY.md`, the relevant `.ai/maps/`.
3. Make the code change that satisfies its acceptance criteria. Keep it to what the ticket asks.
4. Update the progress log with what you changed. Do not tick criteria yet unless a test (`test` modifier) proves them.

**Cook never commits.** No `git add`, `commit`, `stash`, `reset`, `checkout` or `push`, except under `serve`. The code, the ticket file and `BOARD.md` stay uncommitted.

## Modifiers

When several are given, run them in this order, whatever order they were typed: `test`, `review`, `taste`, `serve`. `season` is separate (below) and may be combined with the others.

### `test`
Write and run tests for the code change. One test per acceptance criterion, named with the criterion ID (`orders/03#AC1 the export has a header row`); run them, fix what fails, then run the verification commands in `AGENTS.md` (typecheck, the full test suite). Tick a criterion only when its test passes. A criterion that cannot be tested automatically: say why in the progress log and leave it unticked.

### `review`
Call the Skill tool with `code-review` against `HEAD`, so it reads the uncommitted changes. Fix every finding at or above "should fix", note the rest, and re-run the tests if `test` was given.

### `taste`
Summarize in plain words, not a diff:

- What now works, per acceptance criterion (done, partly, not done and why).
- What changed: the main behaviours and the areas touched.
- Checks and tests run, with the result (or "not run" if `test` was not given).
- Anything that needs the user's attention: a decision you made, something skipped, a bug found along the way.

Then ask: **"Want to dig deeper?"** If yes, show the changes (`git diff HEAD` plus new files), grouped by area, most important first. Wait for the answer before going on, so `serve` never commits while the user is still deciding.

### `serve`
Commit and close the ticket, but only when the work is proven:

1. Validate every acceptance criterion: it is ticked and its test passes (run the tests now if `test` was not given). If any is unmet, stop, list what is missing, and do not commit.
2. Commit the code and tests with a conventional subject: `<type>: <summary> [<ticket>]`, for example `feat: add export [orders/03]`. Type is `feat`, `fix`, `refactor`, `test`, `docs` or `chore`; summary is short, imperative and lowercase.
3. **Gist.** If the user gave one (`gist: <text>` anywhere in the request, for example `/cook-a-ticket [serve] orders/03 gist: empty carts export a header only`), put it in the commit body, after a blank line, in their words with only spelling fixed. No gist, no body.
4. Do not commit the ticket file or `BOARD.md`. Record the commit SHA, the test command and its result in the ticket's Evidence.
5. Run `node .ai/cli/bin/cli.mjs gate deliver --ticket <id>`. If it passes, set the ticket `done`, add a progress log entry ("Served: <SHA>"), and refresh the board (`status --write`). If it fails, leave the ticket `in-progress`, show what the gate reports, and fix it or ask.
6. Leave the ticket file and `BOARD.md` edits uncommitted for the user.

### `season`
A follow-up on the ticket you are working on, for when you tried the result and want it different.

1. Find the ticket currently `in-progress` (if there are several, ask which). No ticket reference is needed.
2. Change the ticket first: add, reword or drop criteria. Never renumber; mark a dropped one `- [ ] ~~AC2: ...~~ dropped: <reason>`, and give a new one the next `ACn`.
3. Log a `Requirement change` entry: date, what changed, why.
4. Then change the code to match. If tests already exist for the affected criteria, update and re-run them. If it is really a different job, say so and make a new ticket.
5. Apply any other modifiers given with it (`[season-test]`, `[season-taste]`).

## Boundaries

- Commit only under `serve`. A user's change request is never permission to commit.
- Not for `/cli loop` or other unattended runs: they depend on `implement`.
