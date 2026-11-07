---
name: prototype
description: Build a throwaway prototype to answer one design question (state, logic, or UI) that is hard to settle on paper.
---

# Prototype

## Rules

- One question per prototype. Write it at the top.
- Throwaway: shortest code that answers it. No tests, no polish.
- Keep it as a primary source on a `prototype/<name>` branch, and link it from the ticket or spec.

## Kinds

- **Logic or state:** a single runnable file (script or HTML page) that exercises the state model with real-looking data.
- **UI:** two to four very different variations on one route, toggled by a switcher, so the user can compare.

## Output

The answer to the question, in two or three lines, ready to paste into the spec as an implementation decision. Inline a snippet only when it states the decision more precisely than prose (a state machine, a schema, a type).
