# Frontend Playbooks

Reference checklists loaded on demand. Owned by the roles that reference this folder.


## Capability: Frontend Implementation

Use when:
- Building or updating pages, views, routes, forms, or client-side behavior.
- Wiring API clients, data fetching, mutations, or browser-specific behavior.

Procedure:
1. Inspect existing frontend patterns, routing, layout primitives, and API client usage in exact source files.
2. Identify affected pages, shared components, contracts, and user-visible states.
3. Implement the smallest change that matches existing conventions and preserves contract compatibility.
4. Coordinate API or contract changes with the builder (backend) before merging incompatible client assumptions.
5. Add or update frontend tests and note verification commands when behavior changes.

Guardrails:
- Do not invent routes, endpoints, response shapes, or design tokens without checking project context.
- Do not bypass loading, error, empty, or success states for convenience.
- Do not change backend contracts without coordination.

Output:
- Page or feature implementation.
- Notes on affected contracts, states, and verification needs.
- Handoffs for API, security, or deployment concerns.

## Capability: Component Design

Use when:
- Creating reusable UI building blocks or refining composition patterns.
- Splitting large views into maintainable, testable components.

Procedure:
1. Inspect existing component libraries, naming conventions, props patterns, and styling approach.
2. Define component boundaries, responsibilities, and public interfaces before implementation.
3. Prefer composition over duplication and reuse existing primitives where sufficient.
4. Keep components focused on presentation and local interaction; push data orchestration to appropriate layers.
5. Document non-obvious usage constraints and add tests for reusable behavior when risk warrants it.

Guardrails:
- Do not introduce a parallel component system when existing patterns are adequate.
- Do not embed business rules that belong in backend services without clear justification.
- Do not create overly generic abstractions for one-off UI needs.

Output:
- Reusable component or composition pattern.
- Usage notes for consumers.
- Test or review notes for shared behavior.

## Capability: Responsive Design

Use when:
- Adapting layouts, navigation, or content presentation across screen sizes or input modes.
- Fixing overflow, clipping, touch-target, or breakpoint issues.

Procedure:
1. Inspect existing breakpoints, layout primitives, spacing tokens, and responsive patterns in the codebase.
2. Identify target viewports, content priority, and interaction differences for the affected UI.
3. Apply responsive changes using established project conventions rather than ad hoc media queries.
4. Verify critical flows at expected breakpoints and with keyboard or touch where relevant.
5. Record any layout assumptions or design tradeoffs that affect future changes.

Guardrails:
- Do not hardcode device-specific hacks when project patterns already solve the case.
- Do not sacrifice accessibility or content clarity for visual compression.
- Do not change global layout systems without checking downstream page impact.

Output:
- Responsive layout updates.
- Breakpoint or layout notes.
- Verification checklist for affected screens.

## Capability: Accessibility Review

Use when:
- Reviewing or improving keyboard support, semantics, focus order, labels, contrast, or screen-reader behavior.
- Fixing accessibility regressions in forms, dialogs, navigation, or dynamic content.

Procedure:
1. Inspect the affected UI for semantic structure, labels, focus management, and ARIA usage against existing project patterns.
2. Identify critical user flows and failure modes for keyboard-only, screen-reader, and low-vision users.
3. Apply practical fixes: correct roles and labels, visible focus, logical tab order, error association, and live-region updates where needed.
4. Avoid decorative ARIA or redundant markup that conflicts with native semantics.
5. Coordinate with qa for manual accessibility verification when changes are substantial.

Guardrails:
- Do not claim full compliance without evidence or responsible verification.
- Do not remove focus indicators or native semantics for styling convenience.
- Do not treat accessibility as optional polish on required user flows.

Output:
- Accessibility fixes or recommendations.
- List of affected flows and verification needs.
- Handoff to qa for broader accessibility testing when needed.

## Capability: State Management

Use when:
- Managing client-side state for forms, filters, selections, pagination, optimistic updates, or view coordination.
- Refactoring state that has become hard to reason about across components.

Procedure:
1. Inspect how the project currently handles local state, shared state, caching, and server synchronization.
2. Identify the smallest state boundary that satisfies the feature without unnecessary global coupling.
3. Model loading, error, empty, success, stale, and retry states explicitly where users depend on them.
4. Keep derived state computed rather than duplicated and preserve predictable update flows.
5. Add tests around state transitions that affect user-visible behavior or contract usage.

Guardrails:
- Do not introduce a new state library or pattern without a clear gap in existing conventions.
- Do not store server truth in client state without a defined sync or invalidation strategy.
- Do not hide backend validation or authorization failures behind ambiguous UI state.

Output:
- State structure or refactor plan.
- Implementation with explicit user-visible states.
- Tests or verification notes for critical transitions.

## Capability: UI/UX Review

Use when:
- Evaluating visual hierarchy, interaction clarity, consistency, copy placement, or workflow friction.
- Polishing UX before release without changing core product scope.

Procedure:
1. Inspect the affected flow against existing design patterns, spacing, typography, and interaction conventions.
2. Identify confusing steps, missing affordances, inconsistent labels, or weak feedback during user tasks.
3. Recommend or apply focused UX improvements that preserve scope and technical boundaries.
4. Ensure loading, error, empty, and success feedback are understandable and actionable.
5. Escalate product-scope or workflow changes to the architect when requirements are unclear.

Guardrails:
- Do not redefine product requirements during a polish pass.
- Do not introduce a new design system when existing patterns are sufficient.
- Do not sacrifice accessibility or contract correctness for visual preference alone.

Output:
- UX findings or improvement notes.
- Targeted UI refinements.
- Follow-up items for product, backend, or QA owners when needed.

## Capability: Frontend Performance Review

Use when:
- Investigating slow rendering, jank, large bundles, expensive re-renders, or sluggish interactions.
- Assessing performance impact before merging substantial frontend changes.

Procedure:
1. Inspect rendering patterns, data-fetch behavior, bundle boundaries, memoization, and list virtualization conventions in exact source files.
2. Identify the likely bottleneck: network chatter, render churn, large assets, layout thrash, or blocking client work.
3. Apply the smallest effective optimization that matches project patterns.
4. Verify the improvement with relevant project checks or targeted measurement when available.
5. Document tradeoffs when an optimization changes loading behavior or caching semantics.

Guardrails:
- Do not optimize prematurely without evidence of user-visible impact.
- Do not add complex caching layers that obscure data freshness requirements.
- Do not change API usage patterns in ways that require backend coordination without a handoff.

Output:
- Performance findings and recommended changes.
- Implemented optimizations when appropriate.
- Verification notes and any backend or asset-pipeline follow-ups.

## Capability: Frontend Testing Coordination

Use when:
- Deciding what frontend tests are needed for a change and how they should be structured.
- Coordinating component, integration, or end-to-end coverage with qa.

Procedure:
1. Inspect existing frontend test conventions, fixtures, mocks, and verification commands.
2. Map changed behavior to the smallest useful test level: unit, component, integration, contract, or e2e.
3. Use `tdd` for executable coverage and coordinate broader QA with qa when risk is high.
4. Cover critical user paths, state transitions, validation, and regression-prone UI behavior.
5. Record which verification commands should run before merge or release.

Guardrails:
- Do not claim coverage without running or specifying the responsible verification.
- Do not duplicate exhaustive manual QA scope inside brittle UI tests without reason.
- Do not mock away contract assumptions that should be validated with backend owners.

Output:
- Test plan or implemented frontend tests.
- Verification command list.
- Handoff to qa for manual, regression, or e2e coverage when needed.

