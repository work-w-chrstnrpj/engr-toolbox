---
name: domain-modeling
description: Build and sharpen the project's domain language and decisions: challenge fuzzy terms, settle overloaded words, update GLOSSARY.md, and write or supersede ADRs. Use when a term is unclear or a hard-to-reverse decision is made.
---

# Domain Modeling

Reading `GLOSSARY.md` is just a pointer. This skill is the active work of changing it.

## Glossary

`GLOSSARY.md` format, one entry per term:

```markdown
**Term**:
One or two sentences: what it is in this project.
_Avoid_: synonyms we do not use
_Source_: docs/inputs/<file> (if it came from a team document)
```

- Challenge any term used two ways ("account" meaning user and billing record). Pick one meaning; give the other its own term.
- Stress-test definitions with edge cases ("is a cancelled order still an order?").
- Record resolved ambiguities under `## Flagged ambiguities`.

## ADRs

Write an ADR only when the decision is **hard to reverse**, **surprising** to a newcomer, or a **real trade-off**. File: `docs/adr/NNNN-<slug>.md`, next free number, using `docs/adr/0000-template.md`.

- **Never rewrite a decision.** When it changes, write a new ADR with `Supersedes: ADR-NNNN`, and change only the old one's status line to `Superseded by ADR-MMMM`.
- **Drift:** if code no longer matches an ADR and nobody decided, ask the user: accept (new ADR matching reality) or reject (ticket to fix the code).
- Typos and clarifications may be edited in place if the decision is unchanged.
- Link the ticket and any input the decision came from.
