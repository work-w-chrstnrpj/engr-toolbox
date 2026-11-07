# ADR-0001: Own adapted workflow skills instead of depending on an upstream plugin

**Status:** accepted
**Date:** 2026-11-07
**Ticket:** n/a (decided before the toolbox tracked its own work)
**Supersedes:** none

## Context

The template needed a disciplined idea-to-release workflow. Matt Pocock's skills (MIT) provide strong engineering disciplines (grilling, tracer-bullet tickets, TDD at seams, two-axis review) but assume a solo, ticket-light flow and ship as a plugin per tool.

## Decision

Adapt and vendor the skills into `.agents/skills/`, rewritten for this project's ticket, evidence and team-input model, and credit them in `THIRD_PARTY_NOTICES.md`.

## Alternatives

- Depend on the upstream plugin: automatic updates, but skill names and behaviour change under us, and Cursor, OpenCode and other tools get separate copies.

## Consequences

One source of truth for every tool and stable skill names the CLI gates can rely on. Upstream improvements must be pulled in by hand; the upstream commit is recorded in `THIRD_PARTY_NOTICES.md`.
