---
name: cut-release
description: Prepare and gate a release: release gate, verification, docs and risk checks, next version, changelog from done tickets, and the pull request to main that triggers the release pipeline. Use before merging to main or cutting a version.
disable-model-invocation: true
---

# Cut Release

## Steps

1. Work on a `release` ticket (call the Skill tool with `tickets`).
2. **Gate.** For every feature in this release run `node .ai/cli/bin/cli.mjs gate release --feature <feature>`. It fails if any ticket is open or a done ticket lacks evidence; with `qa/` it also checks criteria coverage, failing runs and open S1/S2 bugs. Stop and report anything blocked.
3. **Checks.** If `qa/` exists, run the `test-report` skill and use its GO or NO-GO verdict. Run every verification command in `AGENTS.md` (lint, typecheck, test, build, e2e) and record the results; never claim a check passed unless it ran in this session or reliable CI output shows it.
4. **Docs and diff.** `node .ai/cli/bin/cli.mjs drift` and `validate` must be clean. Check the diff for secrets, debug code, large generated files and unrelated changes.
5. **Risk.** List one-way-door changes (migrations, public API, deletes) and their rollback plan.
6. **Choose the version** with semantic versioning: breaking change → major, new behaviour → minor, fixes only → patch. Show the current version (`node .ai/cli/bin/cli.mjs release-version`) and the proposed one; the user decides.
7. **Write the changelog**: add a `## [x.y.z] - YYYY-MM-DD` section at the top of `CHANGELOG.md` with Added, Changed, Fixed and Removed, each line linking its ticket. Done tickets and their Evidence are the source; never invent entries.
8. Bump the version in `package.json` or `VERSION`.
9. Preview the notes: `node .ai/cli/bin/cli.mjs release-notes --version x.y.z`.
10. Open the pull request from the development branch (or the release branch) to main. Call the Skill tool with `pr` for the body. Merging it runs the release pipeline when `pipeline` mode is `release`; otherwise tag and release by hand: `git tag vx.y.z && git push origin vx.y.z`.
11. After the release, record the tag and release link in the ticket's Evidence and close it.

Never push tags, publish packages, or merge to main without the user's explicit go-ahead.
