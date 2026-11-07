# Context Routing

Read the cheapest context first. Stop as soon as you have enough.

1. `AGENTS.md`: goal, stack, verification commands, rules.
2. `GLOSSARY.md`: the project's words.
3. `tickets/BOARD.md`: what is being worked on. Open a ticket file only for the ticket you are working on.
4. The one relevant map in `.ai/maps/`.
5. `docs/adr/` for why things are the way they are; `docs/architecture.md` for boundaries.
6. `docs/inputs/INDEX.md` for team documents; open the input itself only when needed.
7. Search (`rg`) for exact files. Heavier tools only per `.agents/tools/context-strategy.md`.
8. Read the exact source files before editing or claiming anything.

| Task | Map | Reference doc |
|---|---|---|
| UI or client behaviour | `application-map.md` | `docs/design/` |
| Services, jobs, integrations | `service-map.md` | `docs/architecture.md` |
| API contract | `api-map.md` | `docs/api/api-specification.md` |
| Data and persistence | `data-map.md` | `docs/database/data-model.md` |
| Tests and failing checks | `testing-map.md` | `docs/testing/test-specification.md` |
| CI, config, deployment | `deployment-map.md` | `docs/deployment/deployment.md` |
| Test strategy, plans, coverage | `testing-map.md` | `qa/strategy.md`, `qa/traceability.md` |

Maps, indexes and summaries are navigation aids. The code is the truth.
