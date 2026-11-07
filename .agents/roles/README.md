# Roles

Five roles, one per ticket type. A role says who owns the work; skills say how it is done.

| Role | Ticket types | Access |
|---|---|---|
| `architect` | design | read-write |
| `builder` | dev, bug | read-write |
| `reviewer` | review | read-only |
| `qa` | qa (manual, exploratory, UAT, regression runs) | read-write |
| `sdet` | automation (strategy, plans, frameworks, CI tests, flaky tests, reports) | read-write |

Domain checklists (frontend, backend, security, DevOps, QA, SDET, docs, planning) live in `playbooks/` and are loaded only when a ticket needs them.

Role file metadata (`- **Name:**`, `- **Description:**`, `- **Access:**`) is parsed by the generator. `Access: read-only` produces adapters without edit tools.
