# ADR-0002: Ship the project scaffold from template/, keep the tool's own files at the root

**Status:** accepted
**Date:** 2026-11-07
**Ticket:** n/a (decided before the toolbox tracked its own work)

## Context

The repository was both the generator and the scaffold it installs. Its own tests, CI, changelog and placeholder docs leaked into every installed project, and its `AGENTS.md` could never be filled in.

## Decision

Everything copied into a user project lives in `template/` (scaffold) and `.agents/` (canonical assets). The root holds this tool's real `AGENTS.md`, docs, tickets and tests.

## Consequences

Installed projects get only what their tier lists. This repository can use its own workflow (dogfooding) with real tickets and ADRs.
