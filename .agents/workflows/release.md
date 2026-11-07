# Release

From a merged feature to a published version. The CI (Continuous Integration) pipeline part is optional and configurable.

Optional and configurable. Easiest: `/setup-pipeline`. The agent asks what each branch should run and writes the YAML, so feature → develop and develop → main can run different steps (lint, tests, build, tag only, GitHub Release, npm, Docker, deploy). Quick generated defaults: `node .ai/cli/bin/cli.mjs pipeline --mode test|release --write`.

```text
feature/<ticket> ──PR──▶ develop ──PR──▶ main ──▶ release
                   tests              tests       tests + release / tag / npm / Docker
```

**PR (pull request) vs merge.** A PR (GitLab: merge request) is the request to bring a branch in; its checks run *before* anything changes and stop bad code. A merge is the code landing; CI sees it as a push to the target branch, which is where release steps run.

| Event | `test` mode | `release` mode |
|---|---|---|
| PR into develop or main | install, test, build, validate, sync --check, commit ticket check | same |
| Merge into develop | tests | tests |
| Merge into main | nothing | tests, then `v<version>` if that tag does not exist yet: release (with tag), tag only, npm, Docker, as configured |

**CI systems.** GitHub Actions and GitLab CI are generated (`--provider github|gitlab`, detected from the git remote). Any other system (Bitbucket, Azure DevOps, Jenkins, CircleCI): `/setup-pipeline` writes the file by hand with the same stages.

- **Trunk instead:** `--dev-branch none` gives `feature → main`.
- **No accidental releases:** the release job only runs when the version in `package.json` (or `VERSION`) has no tag yet. Bump the version with `/cut-release` to ship.
- **Release notes** come from the matching `CHANGELOG.md` section, else the commit subjects since the last tag.
- **Settings** live in `engr-toolbox.json` under `pipeline`. Regenerate after changes with `pipeline --write`; CI can verify with `pipeline --check`.

## Steps per release

1. Feature branches named after tickets merge into develop through PRs; checks must pass.
2. `/cut-release`: release gate (`gate release --feature <f>`: every ticket done with evidence; with `qa/`, criteria covered and passing and no open S1/S2), `test-report` verdict, verification commands, drift and validate, diff and rollback review, next version, changelog, PR develop → main.
3. Human approval and merge. With the pipeline in `release` mode, CI tests and releases; otherwise push the tag by hand. Deploy only with explicit approval.
4. `/retro`.
