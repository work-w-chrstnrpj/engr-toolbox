# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-11-08

Initial release.

### Added

- Ticket-driven workflow for AI coding agents: grill-with-docs → design → to-spec → to-tickets → implement → cut-release → retro, with a router skill (`/next`, `/ask-engr`) and a scenario guide (`scenarios` workflow).
- Skills and roles in `.agents/` (architect, builder, qa, reviewer, sdet), generated for 11 AI tools; roles become subagents.
- Local ticket system with states, numbered acceptance criteria, evidence, blockers and a generated board; GitHub Issues as an alternative tracker.
- Zero-dependency Node CLI: `init`, `update`, `sync`, `status`, `gate`, `trace`, `drift`, `validate`, `check-commits`, `loop`, `inputs`, `discover`, `pipeline`, `test-report`.
- Phase gates (spec, implement, deliver, release) and a delivery loop that runs until every criterion is proven.
- Ticket guard: Claude Code hooks block source edits and prompt for a ticket when none is in progress; a `commit-msg` hook requires a ticket reference. Mode via `ENGR_GUARD` (`block`, `warn`, `off`).
- Requests with no ticket are ticketed first; mid-ticket requirement changes edit that ticket and log the change.
- `update --check` and `update`: version check and upgrade with saved choices; a daily stale-version warning on `status` and `validate`.
- Batch ingest of team documents, drift detection for teammates' changes, optional CI/CD pipeline generation, project or global install scope.
- `research` skill for cited findings saved to the repo.
