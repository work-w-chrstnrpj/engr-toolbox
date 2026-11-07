# Inputs

Documents from other people: TDDs (Technical Design Documents), API (Application Programming Interface) specs, PRDs (Product Requirements Documents), ERDs (Entity Relationship Diagrams), meeting notes, answered questionnaires.

- **Read-only.** Never edit an input. Our work links to it: designs, ADRs (Architecture Decision Records) and tickets.
- Bring files in with `/ingest`: one file, several, or a whole folder (`/ingest ~/Downloads/payments-team/`). Under the hood `node .ai/cli/bin/cli.mjs inputs add <files or folders> --to <team>` copies only new and changed files, keeps old versions, and records each in `INDEX.md`. The agent then extracts terms and decisions and flags contradictions.
- Organise by team or topic: `docs/inputs/<team>/...`. `.manifest.json` remembers what was ingested (do not edit it).
- A new version keeps the old one (versioned filename) so changes can be diffed.
- Linked documents (Confluence, Google Docs) are recorded in `INDEX.md` without copying.
- Questions for an owner go in `questions/` (written by `/to-questionnaire`).
