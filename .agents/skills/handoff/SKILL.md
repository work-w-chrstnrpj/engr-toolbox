---
name: handoff
description: Compact the current conversation into a portable handoff file so another agent, tool, directory, or teammate can continue the work.
disable-model-invocation: true
---

# Handoff

Use only when the work must travel: a different tool, a different directory, a colleague, or a side task forked mid-phase. Otherwise continue, clear, or compact.

## Steps

1. Write `handoff-<topic>.md` (in the scratch area or the ticket folder) with:
   - **Goal:** one sentence.
   - **Ticket:** ID and link.
   - **State:** what is done, what is in progress, what is next.
   - **Decisions:** made so far, with ADR links.
   - **Pointers:** spec, files, branches, commands. Pointers, not copies.
   - **Open questions.**
2. Add a progress log line to the ticket pointing to the handoff file.
