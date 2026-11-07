---
name: to-spec
description: Turn the current conversation into a spec in the ticket tracker. No new interview, only synthesis.
disable-model-invocation: true
---

# To Spec

Synthesise what has already been discussed into a spec. Do not interview again.

## Steps

1. Read `docs/agents/issue-tracker.md` for where specs live. Run `node .ai/cli/bin/cli.mjs gate spec`; if it fails, fix or report what is missing.
2. Explore the code if you have not. Use `GLOSSARY.md` terms throughout and respect ADRs in the area.
3. Propose the **test seams**: the public interfaces where behaviour will be tested. Prefer existing seams and the highest one possible; fewer is better. Confirm them with the user.
4. Write the spec using the template below.
   - Local tracker: `tickets/<feature>/spec.md`.
   - GitHub: one issue labelled as the spec.
5. Tell the user the next step: `/test-plan` if the project has a `qa/` folder, then `/to-tickets`.

## Template

```markdown
# Spec: <Title>

**Status:** ready-for-agent
**Owner:** <name>

## Problem Statement
From the user's point of view.

## Solution
From the user's point of view.

## User Stories
1. As a <actor>, I want <feature>, so that <benefit>
(a long, complete list)

## Implementation Decisions
Modules touched, interfaces changed, schema and API contract changes, architectural decisions (link ADRs), designs (link docs/design). No file paths or code, except a prototype snippet that states a decision more precisely than prose.

## Testing Decisions
The agreed seams, what makes a good test here (behaviour through public interfaces), prior art in the codebase.

## Inputs
Team documents this spec relies on (docs/inputs, with version).

## Out of Scope
## Further Notes
```
