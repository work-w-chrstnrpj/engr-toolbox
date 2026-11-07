# QA

Quality is proven, not felt. Every acceptance criterion (`feature/NN#ACn`) is traced to a manual case or an automated test, and every run leaves evidence.

| Path | What | Owner | Written by |
|---|---|---|---|
| `strategy.md` | Pyramid, tools, environments, CI stages, quality gates | sdet | `/test-strategy` |
| `plans/<feature>.md` | Risk-based plan per spec | sdet + qa | `/test-plan` |
| `cases/<feature>/TC-NN-<slug>.md` | Manual test cases, each with `Covers:` criterion IDs | qa | `manual-testing` |
| `runs/<date>-<feature>-<label>.md` | Manual run results and test reports | qa, sdet | `manual-testing`, `test-report` |
| `runs/history.json` | Automated results per run (from JUnit XML) | generated | `test-report --junit` |
| `traceability.md` | Criterion → cases → automated tests → latest result | generated | `trace --write` |
| `flaky.md` | Tests that both passed and failed in recent runs | generated | `test-report --junit` |
| `test-data/` | Test data rules and synthetic datasets (no real personal data) | sdet | by hand |
| `_templates/` | Starters for every file above | | |

Automated tests live in the code (see `.ai/maps/testing-map.md`). Their names start with the criterion ID they prove: `cart/01#AC1 user can add an item`.
