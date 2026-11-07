# SDET Playbooks

Reference checklists loaded on demand.

## Test pyramid

- Unit: pure logic, fast, many. Integration: one module with its real neighbours (database in a container). Contract: the API shape between services. API: endpoints end to end. UI/e2e: a few critical user journeys only.
- Push each check to the lowest level that proves it. A UI test for a validation rule is a smell.

## Automation framework

- **Structure:** page objects or screen objects for UI, typed API clients for HTTP, fixtures for setup, one folder per feature.
- **Selectors:** `data-testid` or accessible roles and names. Never CSS chains or XPath on layout.
- **Waiting:** wait for a condition (element visible, response received). Never fixed sleeps.
- **Isolation:** each test creates its own data and cleans up, or runs in a fresh environment. No order dependence.
- **Naming:** `feature/NN#AC1 user can add an item to the cart`. The criterion ID makes `trace` and `test-report` work.
- **Assertions:** assert user-visible outcomes and API contracts, not implementation details.
- **Reports:** emit JUnit XML in CI so `test-report --junit` can read it.

## Test data

- Factories or builders over shared fixtures. Seeded, synthetic data only; never production copies or real personal data.
- Secrets come from the CI secret store, never the repo.

## CI test stages

1. Lint and type check. 2. Unit. 3. Integration and contract. 4. API. 5. UI smoke on every PR; full UI regression nightly or before release.
- Fail fast: cheapest stages first. Parallelise and shard the slow ones.
- Retries: at most one automatic retry, and every retried pass is logged as flaky.

## Flaky tests

- A test that both passes and fails on the same code is flaky. Quarantine it (skip with a ticket ID), never ignore it.
- Common causes: timing (sleeps, animations), shared state, test order, real network or clock, unstable selectors, environment data.

## Quality gates

- Every acceptance criterion traced to at least one test or manual case.
- Last run of the feature has zero failures.
- No open S1 or S2 bugs on the feature.
- Flaky rate under the threshold in `qa/strategy.md`.

## Non-functional

- Performance: baseline first, then budget (p95 latency, throughput); run on a stable environment.
- Accessibility: automated checks (axe) in UI tests plus a manual keyboard and screen reader pass by QA.
- Security: dependency scan in CI, authz negative tests at the API level.
