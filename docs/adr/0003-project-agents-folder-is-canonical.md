# ADR-0003: After install, the project's own .agents/ is canonical

**Status:** accepted
**Date:** 2026-11-07
**Ticket:** n/a (decided before the toolbox tracked its own work)

## Context

`sync` used to regenerate adapters from the template package, which overwrote project customisations and required the package for every sync.

## Decision

`init` copies `.agents/` and the workflow CLI (`.ai/cli/`) into the project. `sync`, `status`, `gate`, `drift`, `loop` and `validate` work from the project's own copy. Managed files carry a header; deleting it makes the file project-owned. Re-running `init` upgrades only managed files.

## Consequences

Projects can customise skills safely and run the CLI offline at a pinned version. Upgrades are explicit (`npx github:... init --yes`).
