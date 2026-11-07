# Design

Design deliverables produced by `/design` on `design` tickets, one folder per feature: `docs/design/<feature>/`.

- `erd.md`: entities, keys, relationships (Mermaid `erDiagram`), and changes against the current data model.
- `flow-<name>.md`: user and data flows (Mermaid `flowchart`), sequence diagrams for cross-service calls.
- `api-changes.md`: new or changed endpoints compared with the team's API (Application Programming Interface) spec.

Designs are reviewed in a PR (pull request) before dev tickets start. Starters are in `_templates/`. Reference docs (`docs/api`, `docs/database`) are updated when the dev work lands.
