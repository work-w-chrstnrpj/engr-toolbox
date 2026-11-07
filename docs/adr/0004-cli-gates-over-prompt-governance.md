# ADR-0004: Govern the workflow with deterministic CLI gates, not a controlling prompt

**Status:** accepted
**Date:** 2026-11-07
**Ticket:** n/a (decided before the toolbox tracked its own work)

## Context

The workflow must be enforced (tickets, evidence, blockers) without one large prompt owning the process, which is hard to debug and ignored under pressure.

## Decision

Each skill stays small. Rules that can be checked are checked by the CLI: `gate spec|implement|release`, `validate` (done needs evidence, valid blockers, ADR links, map paths), `check-commits` (ticket references) and `sync --check`, all runnable in CI. The unattended `loop` requires a verification command and a retry cap.

## Consequences

Failures are visible and reproducible. Judgement calls (design quality, review) stay with skills and humans.
