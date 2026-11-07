# Team Sync

Teammates change code without the AI. Keep context true anyway.

1. After `git pull`, run `node .ai/cli/bin/cli.mjs drift`. It lists changes since `.ai/last-sync` and which maps they affect.
2. Run `update-docs`: facts (maps, reference docs) are fixed directly; decisions are drafted as `proposed` ADRs (Architecture Decision Records) and flagged.
3. A `doc-drift` ticket records what changed and which ADRs need the author's confirmation.
4. `node .ai/cli/bin/cli.mjs drift --mark` saves the new sync point.

Optional: CI (Continuous Integration) comments on PRs (pull requests) that change code covered by a map without updating it.
