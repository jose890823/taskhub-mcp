## Exploration: taskhub-mcp-api-key-auth

### Current State

`src/index.ts` manually wires `loadConfig()` → `AuthManager` → `ApiClient` → `ScopeChecker` → all domain tools → the stdio MCP transport. `src/config.ts` already reads `TASKHUB_API_TOKEN` and enforces HTTPS for non-local endpoints, but `AuthManager` treats the environment value as an access token and otherwise loads legacy JWT credentials from `~/.taskhub/credentials.json`. The `taskhub_login` tool still accepts email/password, persists access and refresh tokens, and `ApiClient` retries every `401` through the JWT refresh flow.

The bearer header is already centralized in `src/api-client.ts`, but authentication failures are not API-key aware: a failed refresh turns a server `401` into a generic login-required error, while `403` and backend error details are passed through `ApiError` and `errorResult()` without a redaction or remediation policy. There is no telemetry subsystem and no token logging, but raw error messages and generic JSON formatting paths still need an explicit secret-safety boundary.

`taskhub_whoami` is currently metadata-only with respect to credentials: it requests `/auth/me`, `/auth/mcp-scopes`, and reads local `.taskhub.json`; it does not expose a token. `ScopeChecker` caches the server scope list for five minutes, so it can only be a preflight aid—the backend must remain authoritative for key validity, scope, and project binding. Local context resolves the active sub-project using a longest-prefix match, but several tools use only a root or explicitly supplied project, and task mutations addressed only by task ID do not send an explicit project context.

The tool registry currently exposes authentication, context, search, organization, project, task, comment, notification, activity, and status tools. Most domain handlers perform a local scope check, while context tools do not. The integration suite is a live-backend Vitest suite with hardcoded login fixtures and mutating CRUD tests; `pnpm test` runs it directly. There are no isolated unit or mock-transport tests. README, SECURITY, ARCHITECTURE, and GUIA still describe password login, JWT persistence, refresh, and optional token use; the README count also differs from the current source. Existing worktree changes are unrelated and must remain untouched.

### Affected Areas

- `src/config.ts` — make the environment token the only credential input and remove legacy credential-path assumptions from runtime configuration.
- `src/auth.ts` — replace password login, disk persistence, refresh-token state, and refresh deduplication with an in-memory static-token holder and safe missing-token guidance.
- `src/api-client.ts` — send one opaque environment bearer per request, avoid refresh retries, classify `401` and `403` responses, and redact token/password/header/config material from surfaced errors.
- `src/tools/auth.ts` and `src/tools/index.ts` — remove `taskhub_login`; keep `taskhub_whoami` metadata-only and ensure its descriptions and registration match the new contract.
- `src/scopes.ts` and `src/types.ts` — preserve server scope retrieval as advisory preflight data, model the API-key-era response shape, and avoid treating legacy JWT response types as client credentials.
- `src/context.ts`, `src/tools/context.ts`, `src/tools/projects.ts`, `src/tools/tasks.ts`, and `src/tools/statuses.ts` — make effective local project context explicit at API boundaries and ensure it cannot override the server-side key binding, especially for resource operations addressed by IDs.
- `src/tools/organizations.ts`, `src/tools/comments.ts`, `src/tools/notifications.ts`, `src/tools/activity.ts`, and `src/tools/search.ts` — verify each endpoint’s required server scope and project/organization policy; preserve formatted output without exposing auth material.
- `src/tools/helpers.ts` — centralize safe error rendering and prevent backend details or generic entity output from leaking secret-bearing values.
- `tests/integration.test.ts` and new isolated tests — replace hardcoded password fixtures with injected token configuration, add mocked request-contract tests for missing/invalid/expired/revoked tokens, `403` insufficient scope, project denial, redaction, and no refresh behavior; keep live CRUD tests explicitly opt-in because they mutate a backend.
- `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, and `GUIA.md` — document environment-only `TASKHUB_API_TOKEN`, HTTPS bearer transport, migration from legacy files/login, expiration/revocation replacement guidance, scope/project behavior, and secret-safe diagnostics.
- `package.json` and package validation — retain build/test scripts while adding a non-live contract-test path and validating the published `dist` package; only README and LICENSE are currently included in the package files list.

### Approaches

1. **Strict environment-only static-token cutover** — Treat `TASKHUB_API_TOKEN` as an opaque bearer credential, remove password login and all disk/JWT refresh behavior, and make the client surface stable API-key-aware guidance for authentication and authorization failures.
   - Pros: directly satisfies the security goal, eliminates password and refresh-token handling, makes revocation/expiry immediate on the server, avoids credential-file leakage, and simplifies the composition root.
   - Cons: breaking change for existing MCP installations; requires coordinated documentation and test migration, plus an explicit project-context contract for resource routes.
   - Effort: **Medium**

2. **Dual-mode compatibility client** — Continue accepting the legacy credential file and `taskhub_login` while preferring `TASKHUB_API_TOKEN`, and gradually migrate users.
   - Pros: lower short-term migration friction and fewer immediate client failures.
   - Cons: retains password collection, persisted JWTs, refresh races, and ambiguous `401` behavior; makes it easy to mistake a JWT for an API key and conflicts with the requested environment-only security boundary.
   - Effort: **Medium**, with higher security and maintenance cost

### Recommendation

Use the **strict environment-only static-token cutover**. Keep the existing variable name `TASKHUB_API_TOKEN`, treat its value as opaque, never read or write `~/.taskhub/credentials.json`, remove `taskhub_login`, and do not attempt refresh after `401`. Map server-safe `401` responses (missing, malformed, expired, or revoked key) to actionable replacement guidance, and map `403` responses to either missing-scope or project/authorization guidance without echoing backend details, headers, or configuration.

Keep `taskhub_whoami` limited to user metadata, server-reported scopes, and the local linked/effective project; it must never reveal or infer the secret. The local `ScopeChecker` may reduce unnecessary calls, but server scopes and server-side project binding must be authoritative on every protected request. Before proposal, define how each project-sensitive tool supplies the effective project ID or uses a backend-supported route resolver, because local `.taskhub.json` alone cannot prove that a key is valid for the requested project.

Use mocked fetch/contract tests as the default test layer and make live integration tests require explicit environment configuration and opt-in execution. Update all authentication documentation, including the currently contradictory architecture guides, and scan source, tests, docs, output, and package contents for literal credentials or secret-bearing error paths.

### Risks

- Removing `taskhub_login` and legacy files is a breaking change; migration must direct users to create, configure, validate, and revoke-and-replace project-bound keys without silently converting JWTs.
- A local project or sub-project mapping can disagree with a key’s server binding; resource context must be supplied early enough for server authorization and must fail closed on cross-project requests.
- Five-minute local scope caching can become stale after scope changes; it must never bypass server enforcement or delay key revocation.
- Passing raw `ApiError` messages/details through `errorResult()` can leak backend-sensitive material even though the current client has no telemetry and does not log tokens.
- The current live integration suite contains credential-like fixtures and mutates backend data; running it is unsafe without explicit test-environment authorization, and converting it requires avoiding secrets in artifacts and logs.
- Documentation and source are already drifting (tool counts, auth model, and generated `dist` state); a client-only edit could leave users with an insecure or nonfunctional setup guide.
- The backend’s exact API-key error codes and project-resolution contract must be confirmed before implementation; the MCP client should not invent a server response shape.

### Ready for Proposal

Yes. The proposal can proceed with the strict environment-only client boundary, provided it records the backend contract for API-key `401`/`403` codes and project binding, the migration treatment of legacy files and `taskhub_login`, and the opt-in policy for live integration tests. No proposal, specification, design, or task artifacts were created in this exploration.
