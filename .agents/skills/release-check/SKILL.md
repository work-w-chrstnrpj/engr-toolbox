---
name: release-check
description: Gate a feature or version for merge or release: every ticket done with evidence, checks green, docs and changelog current. Use before merging a feature branch or cutting a release.
---

# Release Check

## Steps

1. Run `node .ai/cli/bin/cli.mjs gate release --feature <feature>`. It fails if any ticket is not `done`/`wontfix` or a done ticket lacks evidence. Fix or report.
2. If `qa/` exists (medium and large), run the `test-report` skill and use its GO or NO-GO verdict.
3. Run every verification command in `AGENTS.md` (lint, typecheck, test, build, e2e). Record the results.
4. Run `node .ai/cli/bin/cli.mjs drift` and `validate`: maps, reference docs and ADR links must be current.
5. Check `CHANGELOG.md` has an entry for this feature linking its tickets.
6. Check for secrets, debug code, large generated files, and unrelated changes in the diff.
7. List one-way-door changes (migrations, public API, deletes) and their rollback plan.
8. Write the result into a `release` ticket or the PR: checks run with results, risks, rollback. Then call the Skill tool with `pr` for the PR body.

## Boundaries

- Never deploy to production without explicit approval.
- Never claim a check passed unless it ran in this session or reliable CI output shows it.
