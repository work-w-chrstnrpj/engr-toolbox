# Documentation Playbooks

Reference checklists loaded on demand. Owned by the roles that reference this folder.


## Capability: technical writing

Use when:
- Creating or revising general technical documentation for developers, operators, or contributors.
- Improving clarity, structure, and accuracy of README files, guides, or wiki pages.

Procedure:
1. Identify the audience, purpose, and canonical sources of truth for the topic.
2. Read exact source, configs, tests, and existing docs before describing behavior or commands.
3. Organize content with scannable headings, prerequisites, steps, examples, and troubleshooting where useful.
4. Remove outdated sections and align terminology with project conventions.
5. Use `update-docs` when applying documentation changes after verified behavior review.

Guardrails:
- Do not invent commands, paths, flags, or behavior not confirmed in source or owner input.
- Do not leave contradictory docs in place; note superseded pages or sections when replacing them.
- Do not document secrets, tokens, or private endpoints in plain text.

Output:
- Updated technical documentation with accurate examples.
- List of verified sources used.
- Follow-up questions for owning roles when details are missing.

## Capability: API documentation

Use when:
- Documenting endpoints, request and response shapes, auth, errors, versioning, and usage examples.
- Updating API docs after contract or handler changes.

Procedure:
1. Read route definitions, handlers, schemas, OpenAPI or contract files, and existing API docs.
2. Document purpose, auth requirements, parameters, request body, response body, status codes, and error cases.
3. Include minimal working examples and compatibility or deprecation notes when relevant.
4. Cross-check docs against tests or example clients where available.
5. Hand contract mismatches to the builder (backend) rather than silently correcting code behavior in docs.

Guardrails:
- Do not document endpoints or fields that do not exist in the current implementation without clear future/preview labeling.
- Do not expose internal-only or admin endpoints in public docs without intent confirmation.
- Do not copy generated snapshots as truth without verifying against source.

Output:
- API documentation with endpoint coverage and examples.
- Deprecation, versioning, and auth notes.
- Contract discrepancy reports for engineering handoff.

## Capability: onboarding docs

Use when:
- Creating setup, first-run, contribution, or developer onboarding guides for new contributors.
- Reducing time-to-first-successful-build, test, or local run.

Procedure:
1. Identify supported environments, prerequisites, bootstrap commands, and common failure modes from project docs and scripts.
2. Verify install, build, test, and run steps against current tooling; prefer copy-pasteable commands.
3. Document repository layout at a high level and where to find rules, maps, tests, and owning roles.
4. Include troubleshooting for frequent setup issues and links to deeper references.
5. Update onboarding docs when bootstrap scripts, dependencies, or verification commands change.

Guardrails:
- Do not document deprecated setup paths without marking them removed or legacy.
- Do not assume IDE- or OS-specific steps apply universally without noting alternatives.
- Do not include credentials or local secret examples.

Output:
- Onboarding guide with verified setup and first-run steps.
- Troubleshooting section for common blockers.
- Pointers to deeper architecture, API, and operations docs.

## Capability: operations documentation

Use when:
- Documenting deployment, runtime configuration, monitoring, alerting, backup, recovery, and operator procedures.
- Supporting handoff between development and operations for production or staging systems.

Procedure:
1. Gather deployment flow, environment variables, health checks, schedules, and recovery steps from DevOps and backend owners.
2. Verify commands, service names, dashboards, and rollback paths against current scripts and configs.
3. Document normal operation, failure detection, escalation, and manual recovery in operator-friendly language.
4. Note permissions, approval requirements, and environments where procedures differ.
5. Coordinate sensitive wording with the reviewer (security) when documenting auth, secrets, or access paths.

Guardrails:
- Do not document production procedures that were not verified or approved by operations owners.
- Do not embed live credentials, connection strings, or private URLs in docs.
- Do not omit rollback or recovery steps for destructive operations.

Output:
- Operations documentation with deploy, monitor, and recovery sections.
- Environment and configuration reference without secret values.
- DevOps review handoff when operational details are uncertain.

## Capability: workflow documentation

Use when:
- Documenting automation workflows, scheduled jobs, CI pipelines, batch processes, or internal operator workflows.
- Explaining triggers, inputs, outputs, retries, and failure handling for non-request-driven work.

Procedure:
1. Read workflow definitions, scripts, schedules, queue configuration, and owner notes from exact source.
2. Document trigger, frequency, prerequisites, inputs, outputs, side effects, and observability signals.
3. Explain retry, idempotency, manual re-run, and failure escalation paths when applicable.
4. Align terminology with operations and backend docs to avoid duplicate conflicting descriptions.
5. Update workflow docs when behavior, schedules, or permissions change.

Guardrails:
- Do not invent schedules, queue names, or side effects not confirmed in source.
- Do not document bypass steps that weaken safety controls without explicit approval.
- Do not describe workflows as idempotent unless verified.

Output:
- Workflow documentation with trigger-to-outcome flow.
- Failure, retry, and operator action notes.
- Cross-links to operations and integration docs.

## Capability: integration documentation

Use when:
- Documenting third-party APIs, webhooks, device protocols, message formats, or partner integration behavior.
- Supporting implementers and operators who integrate with external systems.

Procedure:
1. Collect contract details, auth model, endpoints, payload schemas, rate limits, and error semantics from owners and source.
2. Document inbound and outbound flows, mapping rules, retries, and environment-specific configuration.
3. Include examples of valid messages or requests and common failure cases without live secrets.
4. Note versioning, compatibility, and support contacts or escalation paths when known.
5. Flag undocumented behavior discovered during documentation for the builder (backend) review.

Guardrails:
- Do not publish partner credentials, signing keys, or tenant-specific secrets.
- Do not document internal integration shortcuts that skip validation or auth.
- Do not assume external vendor docs are current without project-specific verification.

Output:
- Integration guide with flows, schemas, and examples.
- Configuration and auth overview without secret values.
- Engineering follow-up for contract gaps or drift.

## Capability: changelog writing

Use when:
- Recording user-visible, operator-visible, or contributor-visible changes for a release or merge batch.
- Preparing release notes from completed work items and verified changes.

Procedure:
1. Collect merged changes, migration notes, breaking changes, and verification status from plans, PRs, and owners.
2. Group entries by audience: features, fixes, breaking changes, deprecations, security, operations.
3. Write concise entries describing impact and required follow-up actions such as migrations or config updates.
4. Exclude internal-only refactors unless they affect build, test, deploy, or contributor workflow.
5. Coordinate with the architect and the builder (DevOps) for release timing and operational notes.

Guardrails:
- Do not include unverified changes or speculative fixes in release notes.
- Do not omit breaking changes, migrations, or manual operator steps.
- Do not expose vulnerability details beyond agreed disclosure wording.

Output:
- Changelog or release notes draft.
- Breaking change and migration callouts.
- Links to deeper docs when needed.

## Capability: ADR writing coordination

Use when:
- Publishing, editing, or aligning architecture decision records produced by the architect or engineering leads.
- Ensuring ADRs are readable, discoverable, and consistent with project documentation standards.

Procedure:
1. Read the ADR draft, related design docs, and affected modules for context and terminology consistency.
2. Ensure the ADR includes context, decision, alternatives, consequences, and status or supersession notes.
3. Improve clarity and structure without altering the technical decision without architect approval.
4. Place the ADR in the project's canonical documentation location and cross-link from relevant indexes or wiki pages.
5. Use `update-docs` to apply publication changes and note follow-up implementation or doc tasks.

Guardrails:
- Do not change architectural decisions while copyediting; escalate conflicts to the architect.
- Do not publish ADRs that contradict current implementation without status marking as proposed or superseded.
- Do not create ADRs for trivial decisions that add noise.

Output:
- Published or polished ADR with consistent structure.
- Cross-links from related docs.
- Follow-up documentation tasks list.

## Capability: RCA report coordination

Use when:
- Formatting completed investigation findings into a formal root cause analysis report.
- Coordinating timeline, impact, cause, remediation, and prevention sections after an incident or major defect.

Procedure:
1. Confirm investigation is complete and findings are verified; use `diagnosing-bugs` outputs only as input, not as the final RCA.
2. Gather timeline, impact, detection, root cause, contributing factors, and remediation actions from responsible roles.
3. Use `generate-rca` to structure the report with neutral, evidence-based language and clear corrective actions.
4. Review sensitive details with the reviewer (security) and owning managers before publication.
5. Publish the RCA to the agreed location and link follow-up tasks or prevention items.

Guardrails:
- Do not assign root cause without evidence or owner confirmation.
- Do not include secrets, personal data, or exploitable details beyond approved disclosure.
- Do not treat investigation notes as a finished RCA without formatting and stakeholder review.

Output:
- RCA report with timeline, cause, impact, and actions.
- Prevention and follow-up task summary.
- Publication location and review handoffs.

