# Glossary

The project's shared language. Agents and people use these words, and only these, for these things. Maintained by the `domain-modeling` skill.

## Terms

**Ticket**:
One tracked unit of work with a type, a status, blockers, acceptance criteria, a progress log and evidence.
_Avoid_: task, story, card

**Acceptance criterion**:
One testable condition on a ticket, numbered `AC1`, `AC2`. Referenced as `<ticket>#AC<n>` by tests and manual cases.

**Test case**:
A manual check in `qa/cases/` that covers one or more acceptance criteria.

**Run**:
One execution of manual cases (`qa/runs/*.md`) or an automated suite (recorded from JUnit XML).

**Flaky test**:
An automated test that both passed and failed on the same code in recent runs.

<!-- Add project terms below in the same shape:
**Term**:
What it means in this project.
_Avoid_: words we do not use for it
_Source_: docs/inputs/<file> section N
-->

## Flagged ambiguities

<!-- "account" meant both the login and the billing record. Resolved: login is **User**, billing is **Account**. -->
