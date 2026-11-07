# Commands

Install or upgrade: `npx github:work-w-chrstnrpj/engr-toolbox [init] [options]`
Short command: `npm install -g github:work-w-chrstnrpj/engr-toolbox` once, then `engr <command>` in any project (it delegates to the project's `.ai/cli/` copy; `init` runs from the global copy).
Without it: `node .ai/cli/bin/cli.mjs <command> [options]`. In this repository: `node bin/cli.mjs`.
In coding agents: the `cli` skill (`/cli status`) or plain words.

All commands work on the current directory unless `--into <dir>` is given. Exit code 1 means a check failed.

## discover

See what this project has installed. Works in the terminal, and inside coding agents through the `discover` skill (`/discover skills`).

| Command | Shows |
|---|---|
| `discover` or `--help-discover` | Main flow, skills, roles, workflows, structure, commands |
| `discover skills` or `--help-discover-skillset` | Skills you run (`/name`) and skills the agent picks up itself |
| `discover roles` or `--help-discover-role` | Roles with access and what they own |
| `discover workflows` or `--help-discover-workflow` | Main flow and every workflow |
| `discover docs` or `--help-discover-docs` | Every doc and context file with its status (NOT_STARTED, accepted, ...) |
| `discover structure` or `--help-discover-structure` | Folders and what each is for |
| `discover commands` | CLI commands |
| `discover skill tdd`, `discover role sdet`, `discover workflow quality`, or `discover tdd` | One item in detail |
| `--search <word>` | Filter any list, for example `discover skills --search flaky` |

## init

Install or upgrade. Interactive in a terminal; `--yes` uses flags, then saved choices from `engr-toolbox.json`, then detected defaults.

| Option | Values |
|---|---|
| `--mode` | `new`, `existing` (new adds `application/`, `service/`, `shared/`, `tests/`) |
| `--size` | `small`, `medium`, `large` |
| `--tools` | comma list of tools |
| `--tracker` | `local`, `github`, `other` |
| `--scope` | `project` (default) or `global`: where skills, roles, workflows and policies go. Global puts them in `~/.engr-toolbox/.agents/` and each tool's user folder; project-specific files stay in the project |
| `--yes`, `--dry-run`, `--force`, `--verbose` | |

Writes `.agents/` (managed), the tier's scaffold (project-owned, created once), `.ai/cli/`, `engr-toolbox.json`, and adapters. `--force` overwrites project-owned files. `<tool>` alone (for example `claude`) is shorthand for `init --yes --tools <tool>`.

## status

Board in the terminal. `--write` rewrites `tickets/BOARD.md`. `--feature <f>` filters. `--json` prints parsed tickets.

## gate <phase>

`spec`, `implement --ticket <feature/NN>`, `release --feature <feature>`. Prints what passed and what blocks. When `qa/` exists, `release` also blocks on uncovered criteria, criteria failing in the latest run, a failing latest automated run, and open S1/S2 bugs.

## drift

Changes since `.ai/last-sync`: commits, changed files, maps that point at them, files no map covers, reference docs that may need updating, broken map paths. `--since <ref>` overrides the sync point. `--mark` saves `HEAD` as the new sync point. `--json` for machines.

## validate

Roles, skills (including that skills only call model-invoked skills that exist), ADR status and supersede links, map paths, tickets (status, blockers, evidence on done), and core context. `--task api|database|deployment|testing` blocks when that reference doc is not started.

## check-commits

`--range <base>..<head>`. Every non-merge commit must reference a ticket (`feature/NN` that exists, or `#123`), or say `[no-ticket]`.

## trace

Every acceptance criterion on dev and bug tickets (`feature/NN#ACn`) with its manual cases (`Covers:` lines in `qa/cases/`), automated tests (source files that mention the ID), and latest results (manual from `qa/runs/*.md`, automated from `qa/runs/history.json`). `--feature <f>`, `--write` writes `qa/traceability.md`, `--strict` exits 1 when any criterion is uncovered.

## test-report

`--junit <file or folder>` reads JUnit XML. Without `--write` it only prints. With `--write` it appends to `qa/runs/history.json`, rewrites `qa/flaky.md` (tests that passed and failed in the last 10 runs), writes `qa/runs/<date>-<feature>-<label>.md`, and with `--ticket <f/NN>` adds the result to that ticket's Evidence and progress log. Options: `--feature`, `--label`. Exits 1 when any test failed.

## loop

Works the frontier one ticket at a time. Claims the ticket, runs `--agent "<cmd>" '<prompt>'`, runs `--verify "<cmd>"` (or `checks` in `engr-toolbox.json`, or `npm test`), moves green tickets to `in-review`, retries up to `--max-attempts` (3), then sets `ready-for-human` and stops. Options: `--max-tickets` (1), `--feature`, `--types` (`dev,bug,automation`), `--dry-run`. Never commits, pushes or merges itself.

## sync

Regenerates adapters from the project's `.agents/`, or from `~/.engr-toolbox/.agents/` when the project was installed with `--scope global` (`--scope` overrides). `--target <tool|all>` (default: tools in `engr-toolbox.json`), `--clean` removes stale managed files, `--check` fails if anything is out of date, `--dry-run`, `--force`.

## uninstall

`--scope global` removes the globally installed skills, roles and `~/.engr-toolbox/`, only files that carry this tool's header. `--tools <list>` limits it, `--dry-run` previews. Project files are yours; remove them with git.

## measure

Startup and on-demand token cost per tier, role and skill sizes.

## File statuses

`created`, `updated`, `unchanged`, `skipped_user_file` (project-owned, left alone), `removed_stale`.
