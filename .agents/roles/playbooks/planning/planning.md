# Planning Playbooks

Reference checklists loaded on demand. Owned by the roles that reference this folder.


## Capability: product requirements

Use when:
- Converting goals, ideas, or stakeholder requests into clear product requirements.
- Documenting user needs, constraints, and expected outcomes before implementation starts.

Procedure:
1. Read project goals, existing requirements docs, and relevant behavior from wiki and source when needed.
2. State the user problem, target users, desired outcome, and constraints in concrete terms.
3. Separate must-have requirements from nice-to-have items and note assumptions or open questions.
4. Ensure each requirement is understandable to engineering, QA, and documentation roles without inventing implementation detail.
5. Route architecture, security, and operational questions to specialist roles before finalizing scope.

Guardrails:
- Do not write production code or prescribe low-level implementation unless coordinating a planning spike.
- Do not leave ambiguous verbs such as "fast," "secure," or "easy" without measurable context.
- Do not expand scope silently; record new requests explicitly.

Output:
- Product requirements document or concise requirement set.
- Assumptions, open questions, and dependencies.
- Specialist review handoffs where needed.

## Capability: acceptance criteria

Use when:
- Defining how success will be verified for a story, feature, milestone, or bugfix.
- Making work testable for SQA and implementation roles.

Procedure:
1. Derive acceptance criteria from user-visible behavior, operational outcomes, and stated non-goals.
2. Write criteria that are specific, observable, and pass/fail without subjective judgment where possible.
3. Include happy path, key edge cases, error handling, permissions, and workflow completion signals when relevant.
4. Map criteria to verification owner: manual QA, automated tests, API checks, or operator validation.
5. Revise criteria when implementation discoveries change scope; keep a clear before/after record.

Guardrails:
- Do not mark criteria complete before responsible verification reports evidence.
- Do not write criteria that depend on undocumented or unowned system behavior.
- Do not use acceptance criteria to smuggle undefined feature scope.

Output:
- Acceptance criteria list tied to requirements or stories.
- Verification method per criterion.
- Change log for revised criteria when scope shifts.

## Capability: task breakdown

Use when:
- Splitting a feature, epic, or objective into implementable tasks with owners and sequencing.
- Preparing work for specialist agents or human contributors.

Procedure:
1. Review the approved requirement, acceptance criteria, and known dependencies or constraints.
2. Decompose work into small deliverables that map to clear ownership: frontend, backend, DevOps, QA, docs, security.
3. Identify sequencing, blocking dependencies, spikes, and parallelizable tasks.
4. Assign owners or responsible roles; note required handoffs and verification per task.
5. Use `to-spec` when a formal implementation plan is needed without editing code.

Guardrails:
- Do not create tasks without acceptance or verification expectations for user-facing work.
- Do not assign architecture or security decisions to implementation tasks without specialist input.
- Do not produce oversized tasks that hide multiple independent deliverables.

Output:
- Task breakdown with owners, dependencies, and order.
- Handoff and verification notes per task.
- Blockers and unresolved decisions list.

## Capability: roadmap and MVP planning

Use when:
- Sequencing delivery phases, MVP scope, and follow-up work across milestones.
- Balancing user value, risk, dependencies, and team capacity.

Procedure:
1. Clarify the outcome for the next milestone and what is explicitly deferred.
2. Group requirements into MVP, fast-follow, and later phases with rationale.
3. Identify cross-cutting dependencies: architecture, data, integrations, operations, security, and testing.
4. Order work to reduce rework and surface risky unknowns early via spikes or proofs.
5. Publish the roadmap view and sync milestone expectations with specialist roles.

Guardrails:
- Do not commit to dates or capacity without stated assumptions.
- Do not label work MVP if critical acceptance or operational readiness is deferred without acknowledgment.
- Do not plan phases that violate project constraints or unreviewed security requirements.

Output:
- MVP and phased roadmap summary.
- Deferred scope with reasons.
- Milestone goals and dependency map.

## Capability: scope/non-goal clarification

Use when:
- Preventing scope creep, ambiguous ownership, or duplicate work across agents.
- Responding to new requests that may change priorities or boundaries.

Procedure:
1. Restate the current approved goal, in-scope items, and known non-goals.
2. Compare the new request against user value, constraints, and milestone impact.
3. Decide adopt, defer, replace, or reject with explicit rationale and stakeholder-visible wording.
4. Update requirements, acceptance criteria, and task breakdown when scope changes.
5. Notify affected specialist roles of boundary changes and new verification needs.

Guardrails:
- Do not accept scope changes without updating acceptance and verification expectations.
- Do not use non-goals to avoid documenting necessary operational or security work.
- Do not resolve product tradeoffs by assigning them silently to engineering.

Output:
- Updated scope statement with in-scope and non-goals.
- Decision record for accepted or rejected changes.
- Revised plan and handoff notes.

## Capability: risk and dependency tracking

Use when:
- Monitoring blockers, external dependencies, technical unknowns, and delivery risks across active work.
- Supporting go/no-go decisions before implementation or release proceeds.

Procedure:
1. Collect risks and dependencies from requirements, plans, specialist status reports, and observed blockers.
2. Classify each item: dependency, unknown, capacity, security, operational, or verification gap.
3. Assign owner, severity, mitigation, and needed decision or escalation path.
4. Review open items regularly; close only when mitigated, accepted with rationale, or no longer relevant.
5. Escalate architecture, security, or operational risks to the appropriate specialist role.

Guardrails:
- Do not hide unresolved blockers to preserve schedule appearance.
- Do not treat unverified assumptions as resolved dependencies.
- Do not track risks without actionable next steps or owners.

Output:
- Risk and dependency register with status.
- Mitigation actions and escalation needs.
- Updated plan impact summary.

## Capability: milestone readiness

Use when:
- Determining whether a milestone, release, or deliverable is ready to mark complete.
- Coordinating final status from implementation, QA, security, operations, and documentation roles.

Procedure:
1. List milestone acceptance criteria, required verifications, and outstanding tasks from the plan.
2. Request or review status reports from responsible specialist roles; do not infer completion from code presence alone.
3. Check blockers, open defects, missing docs, unreviewed security concerns, and operational readiness items.
4. Record ready, ready with accepted risk, or not ready with explicit gaps and owners.
5. Use `release-check` when merge or release verification is part of milestone closure.

Guardrails:
- Do not mark a milestone complete without verification or a responsible role status report.
- Do not waive security or operational gaps without documented acceptance and owner sign-off.
- Do not confuse code merged with user-visible or production-ready outcomes.

Output:
- Milestone readiness summary with go/no-go recommendation.
- Open gaps, owners, and accepted risks.
- Follow-up tasks and communication notes.

