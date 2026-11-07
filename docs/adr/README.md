# Architecture Decision Records

One file per decision: `NNNN-short-slug.md`, numbered in order. Copy `0000-template.md`.

Write one only when a decision is hard to reverse, surprising to a newcomer, or a real trade-off.

- Never rewrite a decision. Write a new ADR with `Supersedes: ADR-NNNN` and change the old one's status to `Superseded by ADR-MMMM`.
- Typos and clarifications may be edited in place.
- `validate` fails if a supersede link points to a missing ADR.
