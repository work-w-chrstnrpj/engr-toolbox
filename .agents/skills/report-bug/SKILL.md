---
name: report-bug
description: File a reproducible bug ticket with severity, steps, expected and actual results, evidence, and the acceptance criterion it breaks. Use whenever a test, manual run, or user report finds a defect.
---

# Report Bug

## Steps

1. Reproduce it. If you cannot, say so and record what you tried; file it as `needs-info`.
2. Search existing tickets for a duplicate (`node .ai/cli/bin/cli.mjs status --json` or the tracker). Comment on the duplicate instead of filing a new one.
3. File it with the `tickets` format (call the Skill tool with `tickets`), `Type: bug`, in the same feature folder as the ticket it breaks, with these extra fields:

```markdown
**Severity:** S1 | S2 | S3 | S4
**Found in:** <feature/NN#ACn, test case TC-NN, or environment and build>
**Found during:** <ticket being worked when it was found, if any>

## Steps to reproduce
1. ...

## Expected
## Actual
## Evidence
- Screenshot, log excerpt, failing test name, request and response (no secrets or personal data)
## Environment
Build or commit, environment, browser or device, test data used.
```

## Severity

| Level | Meaning |
|---|---|
| S1 | Blocker: data loss, security hole, core flow unusable, no workaround |
| S2 | Major: core flow broken with a painful workaround, or many users affected |
| S3 | Minor: non-core flow wrong, easy workaround |
| S4 | Trivial: cosmetic, copy |

Open S1 and S2 bugs in a feature block `gate release`.

4. Set status `needs-triage` (or `ready-for-agent` if fully specified and the user agrees). Bugs found by an agent during `implement` or the unattended loop always start as `needs-triage`: a human decides when they are worked. Link the bug from the run report or failing test's ticket.
