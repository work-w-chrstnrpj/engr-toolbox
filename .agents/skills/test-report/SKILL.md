---
name: test-report
description: Produce a go/no-go test report for a feature or release from automated results, manual runs, traceability, and open bugs. Use before release-check, at the end of a test cycle, or when asked for test results.
---

# Test Report

## Steps

1. Record the latest automated results: `node .ai/cli/bin/cli.mjs test-report --junit <file or folder> --feature <feature> --write`. This appends to `qa/runs/history.json`, updates `qa/flaky.md`, and writes a run summary in `qa/runs/`.
2. Run `node .ai/cli/bin/cli.mjs trace --feature <feature> --write` for criteria coverage.
3. Read the manual runs in `qa/runs/` and open `bug` tickets for the feature.
4. Run `node .ai/cli/bin/cli.mjs gate release --feature <feature>`.
5. Write `qa/runs/<date>-<feature>-report.md` from `qa/_templates/test-report.md`:
   - **Verdict:** GO, GO with known issues, or NO-GO, in the first line.
   - Criteria covered and passing / total.
   - Automated: passed, failed, skipped, flaky.
   - Manual: passed, failed, blocked, not run.
   - Open bugs by severity, with links.
   - Risks from the test plan that remain untested, and why.
6. Link the report from the feature's release ticket or PR Evidence.

Never report GO while `gate release` is blocked unless the user explicitly accepts each blocker; list each accepted blocker in the report.
