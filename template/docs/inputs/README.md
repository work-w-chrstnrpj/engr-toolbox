# Inputs

Documents from other people: TDDs, API specs, PRDs, ERDs, meeting notes, answered questionnaires.

- **Read-only.** Never edit an input. Our work (designs, ADRs, tickets) links to it.
- Bring a file in with `/ingest`. It records the file in `INDEX.md`, extracts terms and decisions, and flags contradictions.
- A new version keeps the old one (versioned filename) so changes can be diffed.
- Linked documents (Confluence, Google Docs) are recorded in `INDEX.md` without copying.
- Questions for an owner go in `questions/` (written by `/to-questionnaire`).
