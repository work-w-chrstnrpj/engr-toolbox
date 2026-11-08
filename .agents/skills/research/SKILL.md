---
name: research
description: Investigate a question against high-trust primary sources and save the findings as a cited Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

# Research

For questions about the outside world: a library's behaviour, an API, a standard, a vendor's limits. Questions about our own code go to `ask-repo-question`.

Do the reading in a **fresh-context subagent** (in the background where the tool supports it) so the main session keeps working. If the tool has no subagents, do it in a clean pass and say so.

## Steps

1. Restate the question in one sentence and name the decision it feeds (a ticket, an ADR, a wayfinder decision ticket).
2. Investigate **primary sources**: official docs, source code, specs, first-party APIs. Not a blog or answer site about them. Follow each claim back to the source that owns it.
3. Write one Markdown file, citing the source (URL or `repo@commit:path`) and retrieval date for every claim. Separate **confirmed** facts from **inferred** or **not found**; never fill a gap with a guess.
4. Save it where the repo already keeps such notes. If there is no convention, use `docs/research/<topic>.md` and say where.
5. Reply with the answer in a few lines and the file path. If it settles a hard-to-reverse choice, offer an ADR via `domain-modeling`.

## Boundaries

- Read-only on the code; the only file written is the findings file.
- Do not send repo content, secrets or customer data to external services while searching.
- A source that conflicts with the code or an ADR is reported, not silently resolved.
