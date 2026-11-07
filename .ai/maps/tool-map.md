# Tool Map

## CLI

- Entry point → `bin/cli.mjs`
- Config, tiers, role and skill parsing → `lib/config.mjs`
- Install and interactive init → `lib/install.mjs`
- Tool adapters → `lib/generator.mjs`
- Managed-file safety → `lib/safety.mjs`
- Tickets, board, frontier → `lib/tickets.mjs`
- Phase gates → `lib/gates.mjs`
- Drift since sync point → `lib/drift.mjs`
- Commit ticket references → `lib/commits.mjs`
- Unattended loop → `lib/loop.mjs`
- Validator → `lib/validator.mjs`
- Token budget → `lib/measure.mjs`

## Content

- Tier definitions → `preset.config.json`
- Canonical skills → `.agents/skills`
- Roles and playbooks → `.agents/roles`
- Workflows → `.agents/workflows`
- Project scaffold → `template`

## Tests

- Suites → `tests`
- CI → `.github/workflows/ci.yml`
