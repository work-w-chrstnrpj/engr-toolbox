# Design First

For teams that must approve ERD, flows and API design before code.

1. `ingest` every team document (TDD, API spec, PRD) into `docs/inputs/`.
2. `grill-with-docs` to settle open questions; send the rest to the owners with `to-questionnaire`.
3. `to-tickets` creates one `design` ticket and the `dev` tickets it blocks.
4. `design` produces `docs/design/<feature>/` (ERD, flows, API changes) and ADRs; the design PR is reviewed by the team.
5. Approval recorded in the design ticket's Evidence → design ticket `done` → dev tickets unblock.
6. Continue with the main flow from `implement`.
