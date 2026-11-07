# Test Strategy

> Status: COMPLETE
**Owner:** <sdet>
**Updated:** YYYY-MM-DD

## Pyramid

| Level | What it proves | Tool | Where | Runs |
|---|---|---|---|---|
| Unit | Pure logic | | | every PR |
| Integration | Module with real neighbours | | | every PR |
| Contract | API shape between services | | | every PR |
| API | Endpoints end to end | | | every PR |
| UI / e2e | Critical journeys only | | | smoke per PR, full nightly |

## Environments and test data

| Environment | Used by | Data | Reset |
|---|---|---|---|

## CI stages

1. Lint and type check → 2. Unit → 3. Integration and contract → 4. API → 5. UI smoke.
- JUnit XML output: `<path>` (read by `test-report --junit`).
- Retries: at most 1; every retried pass is logged as flaky.

## Quality gates

| Gate | Threshold |
|---|---|
| Acceptance criteria traced | 100% |
| Last run failures | 0 |
| Open S1/S2 bugs at release | 0 |
| Flaky rate | < 2% |

## Non-functional

- Performance budget:
- Accessibility standard:
- Security checks:

## Decisions

- Links to ADRs for framework and environment choices.
