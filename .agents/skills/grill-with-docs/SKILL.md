---
name: grill-with-docs
description: Brainstorm an idea or change by interview, and record what is learned in GLOSSARY.md and ADRs as you go.
disable-model-invocation: true
---

# Grill With Docs

Step 1 of the main flow. Sharpen an idea before anything is designed or built, and leave a paper trail.

## Steps

1. Read `AGENTS.md`, `GLOSSARY.md`, `docs/adr/`, `docs/inputs/INDEX.md` and `tickets/BOARD.md` for what already exists.
2. Call the Skill tool with `grilling` and interview the user about the idea.
3. While grilling, call the Skill tool with `domain-modeling` whenever a term is fuzzy or a decision is hard to reverse, and update `GLOSSARY.md` and `docs/adr/` inline.
4. If a question needs running code to answer (a state model, a UI), suggest a detour: call the Skill tool with `prototype`.
5. When no questions remain, tell the user the next step:
   - Needs ERD, flows or API design first → `/design`
   - One session of work → `/implement` with the agreed scope
   - Bigger → `/to-spec`, then `/to-tickets`

Keep this session open until tickets exist: the spec and tickets should be written from this conversation, not a summary of it.
