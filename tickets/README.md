# Tickets

All work lives here. Every ticket ends with evidence.

```text
tickets/
  BOARD.md              ← generated summary, read this first
  <feature>/
    spec.md             ← from /to-spec
    01-<slug>.md        ← one file per ticket, ID <feature>/01
    02-<slug>.md
```

- Format, states and rules: the `tickets` skill (`.agents/skills/tickets/SKILL.md`).
- Create tickets with `/to-tickets`, work them with `/implement`, triage incoming ones with `/triage`.
- See the board: `node .ai/cli/bin/cli.mjs status`. Rewrite `BOARD.md`: `status --write`.
- A `done` ticket with empty Evidence fails `validate`.
- Reference the ticket ID in every commit: `git commit -m "feat: add export [orders/03]"`.
