# Fullstack Playbooks

Reference checklists loaded on demand. Owned by the roles that reference this folder.


## Capability: Fullstack Feature Implementation

Use when implementing a feature touching both client/caller and backend/service surfaces.

Procedure:
1. Inspect existing models, contracts, and communication boundaries between layers.
2. Implement backend service endpoints or domain logic first, verifying input validation and error formats.
3. Implement client/consumer integration using existing UI/client state and network utilities.
4. Add automated tests covering the happy path, boundary conditions, and failure modes.
5. Verify changes with project test commands and document any new APIs or contracts.

Guardrails:
- Do not duplicate data types or contracts across layers if a shared module exists.
- Ensure error responses are handled gracefully across boundaries.

## Capability: Safe Code Refactoring

Use when cleaning up existing code, reducing technical debt, or restructuring logic.

Procedure:
1. Verify existing test coverage exists before altering implementation structure. If missing, write baseline tests first.
2. Make atomic, incremental refactorings while running tests between steps.
3. Maintain public interfaces and backward compatibility unless explicit deprecation is planned.
4. Clean up unused imports, dead code, and obsolete comments.

Guardrails:
- Do not combine feature additions with major structural refactors in a single pass.
- Never disable existing tests to make a refactor pass.
