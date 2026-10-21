# HANDOFF: Authentication Module Refactor

<!--
EXAMPLE — This is a filled-out illustration of a good handoff, not the canonical template.
Use `templates/HANDOFF.md` for the structural scaffold.

This example is intentionally generic:
- no repo-specific product name
- no contributor-specific context
- realistic but reusable mid-task state
-->

**Written**: 2026-04-19T16:20:00+09:00
**Status**: in-progress
**Branch**: feature/auth-refactor
**Last commit**: a1b2c3d refactor(auth): split token validation from session loading

## Task

Refactor the authentication module so token validation, session loading, and request-level authorization are separated into clearer components without changing external behavior.

## Current State

The token validation helper has been extracted and the request middleware now calls it before loading the user session. The middleware path works for valid tokens in local testing, but the integration tests for expired-token handling are still failing because the error response shape is inconsistent with the existing API contract.

## What Was Done

- Extracted token parsing and validation logic into `src/auth/validate-token.ts`.
- Updated `src/auth/middleware.ts` to call the validator before session loading.
- Added focused tests in `tests/auth/validate-token.test.ts` for valid, missing, and malformed tokens.
- Ran `npm test -- tests/auth/validate-token.test.ts` successfully after the refactor.

### Successful Approaches
- Reused the existing request context shape instead of introducing a new auth context object. This reduced downstream edits.
- Verified the extracted validator first with targeted unit tests before reconnecting it to middleware.
- Confirmed the middleware still accepts valid bearer tokens by running:
  - `npm test -- tests/auth/validate-token.test.ts`
  - `npm test -- tests/auth/middleware.valid-token.test.ts`

### Dead Ends
- Tried moving expired-token handling fully into `validate-token.ts`, but that forced transport-level response formatting into a low-level helper and made test expectations harder to preserve.
- Tried normalizing the error response in the integration test fixture instead of the middleware, but that would have hidden a real contract mismatch.

## Key Decisions

- Keep `validate-token.ts` responsible for validation only; response formatting stays in `middleware.ts` so HTTP behavior remains visible at the boundary.
- Preserve the existing request context shape for now. A broader auth-context redesign would be a separate change and is out of scope for this refactor.

## Open Issues

- Expired-token integration tests still fail because the middleware currently returns a different error body shape than the contract expected by `tests/auth/middleware.expired-token.test.ts`.
- [UNKNOWN] Whether the mismatch comes from the middleware branch itself or from a shared error-formatting helper introduced earlier in the project.
- [UNVERIFIED] There may be one more affected endpoint using the same middleware wrapper, but that has not been checked yet.

## Next Steps

1. Run `npm test -- tests/auth/middleware.expired-token.test.ts --runInBand` and capture the exact diff between expected and actual response bodies.
2. Inspect `src/auth/middleware.ts` and any shared response formatter it calls to identify where the expired-token payload diverges from the established contract.
3. Apply the smallest fix that restores the old error body shape without changing valid-token behavior.
4. Re-run the expired-token test, then run the full auth test group to check for regressions.

## Context for Continuation

### Origin
This work came from a larger reliability cleanup plan for the authentication layer after multiple test failures made the middleware logic hard to reason about.

### Constraints
- Do not redesign the full authentication architecture in this task.
- Do not change public API error semantics except to restore existing behavior.
- Keep the fix minimal: this is a behavior-preserving refactor, not a feature addition.

- [PRIOR] Earlier investigation found that downstream handlers assume `req.auth` exists only after middleware success; avoid introducing partial auth state on failure paths.

## Verification Commands

```bash
# verify validator unit coverage
npm test -- tests/auth/validate-token.test.ts

# reproduce the failing expired-token integration case
npm test -- tests/auth/middleware.expired-token.test.ts --runInBand
```

## Key Files

| File | Role |
|------|------|
| `src/auth/validate-token.ts` | Extracted token validation helper |
| `src/auth/middleware.ts` | Request boundary where validation and error response formatting meet |
| `tests/auth/validate-token.test.ts` | Focused validator unit coverage |
| `tests/auth/middleware.expired-token.test.ts` | Failing integration test that currently blocks completion |

## Evidence & References

- Last completed refactor commit: `a1b2c3d refactor(auth): split token validation from session loading`
- Passing targeted check: `npm test -- tests/auth/validate-token.test.ts`
- Failing path to investigate next: `tests/auth/middleware.expired-token.test.ts`
