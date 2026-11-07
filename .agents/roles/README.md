# Roles

Five roles, one per ticket type. A role says who owns the work; skills say how it is done.

| Role | Ticket types | Access |
|---|---|---|
| `architect` | design | read-write |
| `builder` | dev, bug | read-write |
| `reviewer` | review | read-only |
| `qa` (quality assurance) | qa: manual, exploratory, UAT (User Acceptance Testing) and regression runs | read-write |
| `sdet` (software development engineer in test) | automation: strategy, plans, frameworks, CI (Continuous Integration) tests, flaky tests, reports | read-write |

Domain checklists (frontend, backend, security, DevOps, QA (Quality Assurance), SDET (Software Development Engineer in Test), docs, planning) live in `playbooks/` and are loaded only when a ticket needs them.

Role file metadata (`- **Name:**`, `- **Description:**`, `- **Access:**`) is parsed by the generator. `Access: read-only` produces adapters without edit tools.
