---
name: test-plan
description: Write a risk-based test plan for a spec before tickets are made: risks, scope per test level, manual vs automated, entry and exit criteria, and the QA and automation tickets needed.
disable-model-invocation: true
---

# Test Plan

Run right after `/to-spec`, in the same session if possible, and before `/to-tickets`. Output: `qa/plans/<feature>.md`.

## Steps

1. Read the spec, its designs and inputs, `qa/strategy.md`, `GLOSSARY.md`, and existing tests in the touched area.
2. **Risks.** List what could go wrong for users and the business. Score each: likelihood (1 to 3) × impact (1 to 3). Highest scores get the deepest testing.
3. **Scope per level.** For each user story or behaviour, choose the lowest level that proves it (unit, integration, contract, API, UI) and whether QA covers it manually (exploratory, UAT, visual, one-off). Use the seams agreed in the spec.
4. **Criteria.** Make sure every acceptance criterion the tickets will carry is testable. Flag vague ones ("fast", "user friendly") back to the user with a measurable rewrite.
5. **Test data and environments** needed, and anything only a human can set up.
6. **Entry criteria** (when testing can start) and **exit criteria** (when the feature can ship), defaulting to the gates in `qa/strategy.md`.
7. **Tickets to create.** List the `automation` tickets (SDET) and `qa` tickets (QA), each blocked by the dev tickets it tests. Hand this list to `/to-tickets`.
8. Write the plan from `qa/_templates/test-plan.md`. Confirm with the user.
