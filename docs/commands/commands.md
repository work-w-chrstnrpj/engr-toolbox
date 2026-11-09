# Commands

Install or upgrade: `npx --allow-git=all github:work-w-chrstnrpj/engr-toolbox [init] [options]`
Short command: `npm install -g --allow-git=all github:work-w-chrstnrpj/engr-toolbox` once, then `engr <command>` in any project (it delegates to the project's `.ai/cli/` copy; `init` runs from the global copy).
Without it: `node .ai/cli/bin/cli.mjs <command> [options]`. In this repository: `node bin/cli.mjs`.
In coding agents: the `cli` skill (`/cli status`) or plain words.

All commands work on the current directory unless `--into <dir>` is given. Exit code 1 means a check failed.

## discover

See what this project has installed. Works in the terminal, and inside coding agents through the `cli` skill (`/cli discover skills`).

| Command | Shows |
|---|---|
| `discover` or `--help-discover` | Main flow, skills, roles, workflows, structure, commands |
| `discover skills` or `--help-discover-skillset` | Skills you run (`/name`) and skills the agent picks up itself |
| `discover roles` or `--help-discover-role` | Roles with access and what they own |
| `discover workflows` or `--help-discover-workflow` | Main flow and every workflow |
| `discover docs` or `--help-discover-docs` | Every doc and context file with its status (NOT_STARTED, accepted, ...) |
| `discover structure` or `--help-discover-structure` | Folders and what each is for |
| `discover commands` | CLI (command-line interface) commands |
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
| `--pipeline`, `--dev-branch`, `--main-branch`, `--release-targets` | Optional CI/CD (Continuous Integration and Continuous Delivery) at install time; same meaning as in `pipeline` |
| `--working-branch` | Personal branch that tickets branch off and merge into (`none` for no working branch). Asked in step 7 of the interactive install; change any time with `branch set` |
| `--scope` | `project` (default) or `global`: where skills, roles, workflows and policies go. Global puts them in `~/.engr-toolbox/.agents/` and each tool's user folder; project-specific files stay in the project |
| `--yes`, `--dry-run`, `--force`, `--verbose` | |

Writes `.agents/` (managed), the tier's scaffold (project-owned, created once), `.ai/cli/`, `engr-toolbox.json`, and adapters. `--force` overwrites project-owned files. `<tool>` alone (for example `claude`) is shorthand for `init --yes --tools <tool>`.

## branch

Your personal working branch: `implement` and `cook-a-ticket` create a ticket branch from it, and `done` means merged into it. Saved in `engr-toolbox.json` as `workingBranch`. With none set, tickets work on the current branch.

| Command | Does |
|---|---|
| `branch` or `branch show` | The working branch and the current branch |
| `branch set <name> [--create]` | Set (and optionally create from the current branch) the working branch |
| `branch unset` | Work on the current branch again |
| `branch status [--branch <name>] [--base <ref>] [--check]` | How far a branch (default: the working branch) is behind and ahead of the base (default: origin's default branch), with the incoming commits. `--check` exits 1 when behind |
| `branch name <ticket>` | The ticket branch name, such as `ticket/orders-03-export-csv` |

To bring a stale branch up to date, use the `catch-up` skill.

## update

Upgrade a project to the latest engr-toolbox. Keeps your saved choices (size, tools, tracker), refreshes files the toolbox owns, leaves files you edited alone.

| Command | Does |
|---|---|
| `update --check` | Report installed vs latest version. Exit code 1 when stale, so CI can fail on it |
| `update` | Upgrade. From a project's pinned copy it fetches the latest first. `--dry-run` previews, `--force` refreshes even when current |

`status` and `validate` print a one-line warning when the install is behind (checked at most once a day, skipped in CI and offline). Turn it off with `ENGR_NO_UPDATE_CHECK=1`.

## status

Board in the terminal. `--write` rewrites `tickets/BOARD.md`. `--feature <f>` filters. `--json` prints parsed tickets.

## gate <phase>

`spec`, `implement --ticket <feature/NN>`, `deliver --ticket <feature/NN>`, `release --feature <feature>`. Prints what passed and what blocks. `deliver` is the definition of done for one ticket: every acceptance criterion ticked; for `dev`, `bug` and `automation` tickets every criterion named by an automated test (`feature/NN#ACn` in the test name); no open blockers; Commits and Tests evidence recorded. When `qa/` exists, `release` also blocks on uncovered criteria, criteria failing in the latest run, a failing latest automated run, and open S1/S2 bugs.

## inputs

Bring team documents into `docs/inputs/`: one file, several, or whole folders. The `/ingest` skill runs this for you, then reads each file.

| Command | Does |
|---|---|
| `inputs` | List what was ingested, with older versions |
| `inputs scan <files or folders...>` | Show each file as new, changed or unchanged. Writes nothing |
| `inputs add <files or folders...>` | Copy new and changed files; a changed file's previous version is kept beside it with the date (`tdd.2026-11-07.md`); each file gets a row in `INDEX.md` |

Options: `--to <subfolder>` (for example `payments`; a folder otherwise keeps its own name), `--owner <team or person>`, `--version <v>`, `--dry-run`. Hidden files and `node_modules` are skipped; files over 50 MB are listed, not copied. `docs/inputs/.manifest.json` remembers what was ingested.

## drift

Changes since `.ai/last-sync`: commits, changed files, maps that point at them, files no map covers, reference docs that may need updating, broken map paths. `--since <ref>` overrides the sync point. `--mark` saves `HEAD` as the new sync point. `--json` for machines.

## validate

Roles, skills (including that skills only call model-invoked skills that exist), ADR (Architecture Decision Record) status and supersede links, map paths, tickets (status, blockers, evidence on done), and core context. `--task api|database|deployment|testing` blocks when that reference doc is not started.

## check-commits

`--range <base>..<head>`. Every non-merge commit must reference a ticket (`feature/NN` that exists, or `#123`), or say `[no-ticket]`.

## trace

Every acceptance criterion on dev and bug tickets (`feature/NN#ACn`) with its manual cases (`Covers:` lines in `qa/cases/`), automated tests (source files that mention the ID), and latest results (manual from `qa/runs/*.md`, automated from `qa/runs/history.json`). `--feature <f>`, `--write` writes `qa/traceability.md`, `--strict` exits 1 when any criterion is uncovered.

## test-report

`--junit <file or folder>` reads JUnit XML. Without `--write` it only prints. With `--write` it appends to `qa/runs/history.json`, rewrites `qa/flaky.md` (tests that passed and failed in the last 10 runs), writes `qa/runs/<date>-<feature>-<label>.md`, and with `--ticket <f/NN>` adds the result to that ticket's Evidence and progress log. Options: `--feature`, `--label`. Exits 1 when any test failed.

## loop

Works the frontier one ticket at a time. Claims the ticket, runs `--agent "<cmd>" '<prompt>'`, then `--verify "<cmd>"` (or `checks` in `engr-toolbox.json`, or `npm test`) and `gate deliver`. Only when all three pass does the ticket move to `in-review`. Otherwise it retries up to `--max-attempts` (3), giving the agent the exact failures, then sets `ready-for-human` and stops. Tickets the agent raises during the run (bugs found along the way) are listed at the end; they start as `needs-triage`, so the loop never works them itself, and an `S1` stops the run. Options: `--max-tickets` (1), `--feature`, `--types` (`dev,bug,automation`), `--dry-run`. Never commits, pushes or merges itself.

## sync

Regenerates adapters from the project's `.agents/`, or from `~/.engr-toolbox/.agents/` when the project was installed with `--scope global` (`--scope` overrides). `--target <tool|all>` (default: tools in `engr-toolbox.json`), `--clean` removes stale managed files, `--check` fails if anything is out of date, `--dry-run`, `--force`.

## pipeline

Optional CI/CD from settings saved in `engr-toolbox.json` under `pipeline`. Generated for GitHub Actions and GitLab CI; for other CI systems `/setup-pipeline` writes the file. For different steps per branch, use `/setup-pipeline`.

| Option | Values |
|---|---|
| `--provider` | `github` (`.github/workflows/engr-*.yml`), `gitlab` (`.gitlab-ci.yml`), `other` (nothing generated); detected from the git remote |
| `--mode` | `none` (default), `test` runs tests on PRs (pull requests) into develop or main and on pushes to develop; `release` also releases on push to main |
| `--dev-branch` | `develop` (default), any name, or `none` for feature → main |
| `--main-branch` | `main` (default) |
| `--release-targets` | any of `release` (GitHub/GitLab Release with tag), `tag` (tag only), `npm`, `docker` (ghcr.io or the GitLab registry) |
| `--install`, `--test`, `--build` | commands; install is detected from the lock file |
| `--node`, `--version-file` | Node version (22); `package.json` or `VERSION` |
| `--write` | save settings and write the CI file(s) |
| `--check` | exit 1 when the workflow files no longer match the settings |
| `--custom` / `--no-custom` | mark the workflows as hand-made (by `/setup-pipeline`): `--write` then only saves settings and never touches the files. `--no-custom --write --force` goes back to generated files |

Without `--write` it only shows what would happen. A release job runs only when `v<version>` is not tagged yet. Switching to `none` removes the generated workflows; hand-written workflows are never touched.

## release-version, release-notes

`release-version` prints the version from `package.json` or `VERSION`. `release-notes [--version x.y.z]` prints the matching `CHANGELOG.md` section, else the commit subjects since the last tag. The release workflow uses both.

## uninstall

`--scope global` removes the globally installed skills, roles and `~/.engr-toolbox/`, only files that carry this tool's header. `--tools <list>` limits it, `--dry-run` previews.

`--scope project` removes this project's install: generated files with the header (`.agents/`, tool folders, pointer files), `.ai/cli/`, `engr-toolbox.json`, our entries in `.claude/settings.json` and our `commit-msg` hook. A file whose header you deleted is kept. Project-owned files (`AGENTS.md`, `GLOSSARY.md`, `docs/`, `tickets/`, `qa/`, `.ai/maps`) are never touched; delete them yourself if you want them gone. Run `--dry-run` first; it lists every file. `opencode.json` is merged with your settings and is left alone.

## measure

Startup and on-demand token cost per tier, role and skill sizes.

## File statuses

`created`, `updated`, `unchanged`, `skipped_user_file` (project-owned, left alone), `removed_stale`.
