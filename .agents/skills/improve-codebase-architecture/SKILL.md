---
name: improve-codebase-architecture
description: Survey the codebase for deepening opportunities (shallow modules, tangled seams, missing tests seams) and turn the chosen one into an idea for the main flow.
disable-model-invocation: true
---

# Improve Codebase Architecture

A survey, not a rescue. Run it every few days on an active codebase.

## Steps

1. Call the Skill tool with `codebase-design` for the vocabulary.
2. Scan the code (use `.ai/maps/` and `use-context-tools` on large repos). Look for:
   - shallow modules and pass-through layers,
   - logic spread across many files that changes together (poor locality),
   - side effects mixed into core logic (missing adapters),
   - behaviour with no good seam to test it.
3. Present the top three to five candidates, each with: where, the problem in one line, the deeper design in one line, the payoff, the risk.
4. For the one the user picks, call the Skill tool with `grilling` to shape it, then suggest `/to-spec` and `/to-tickets` (usually a prefactoring ticket first, or expand-migrate-contract for wide changes).
