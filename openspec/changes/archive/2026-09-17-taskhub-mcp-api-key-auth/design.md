# Design: TaskHub MCP API-Key Authentication

## Technical Approach

Cut over at the manual composition root and HTTP boundary. Read `TASKHUB_API_TOKEN` once, keep it in memory, and send one HTTPS bearer per request. Remove password login, credential-file I/O, JWT state, refresh, and retry. Preserve formatted output, advisory preflight, and server authority. Backend confirmation gates `401`/`403` classification and project serialization; unknown semantics fail closed.

## Architecture Decisions

| Decision | Choice | Rationale / rejected alternative |
|---|---|---|
| Credential boundary | In-memory `AuthManager`; no filesystem or refresh state. | Dual mode retains removed risks. |
| Failure policy | Centralize confirmed classification/redaction in `ApiClient`/helpers. | Raw details leak; invented codes are forbidden. |
| Project authority | Explicit local context only through a confirmed contract; otherwise stop. | Local context cannot prove key binding. |
| Scope cache | Retain five-minute advisory cache; backend authorizes every request. | Cache cannot authorize or mask revocation. |

## Data Flow

```text
env TASKHUB_API_TOKEN ─→ AuthManager ─→ ApiClient
local .taskhub.json ─→ resolver ─→ confirmed RequestContext
                                      └─ missing/ambiguous/unverified: fail closed
ApiClient ── one bearer request ─→ backend ─→ sanitized result/error ─→ tool
```

Sequence:

```mermaid
sequenceDiagram
  participant H as Host
  participant M as Tool
  participant A as AuthManager
  participant C as Context
  participant B as Backend
  H->>M: protected tool(contextDir)
  M->>A: get token
  alt missing token
    A-->>M: safe configuration error; no fetch
  else configured token
    M->>C: resolve effective project
    alt missing or ambiguous
      C-->>M: fail closed
    else verified
      M->>B: one HTTPS bearer + context
      B-->>M: 2xx, confirmed 401/403, or unknown error
      M->>M: classify; redact secrets/details
    end
  end
  M-->>H: formatted result or {content, isError:true}
```

`taskhub_whoami` returns `/auth/me`, server scopes, and local/effective context; it never reveals the token.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/index.ts`, `src/config.ts`, `src/auth.ts` | Modify | Environment token; remove legacy state. Replace `src/index.ts:27` raw `config.apiUrl` logging with `redactEndpointForDiagnostic(config.apiUrl)`, a fixed label exposing no endpoint or token. |
| `src/api-client.ts`, `src/tools/helpers.ts`, `src/types.ts` | Modify | No-retry requests, classification, redaction, safe rendering, and API-key types. |
| `src/tools/auth.ts`, `src/tools/index.ts` | Modify | Remove `taskhub_login`; retain metadata-only `taskhub_whoami`. |
| `src/scopes.ts`, `src/context.ts`, `src/tools/*.ts` | Modify | Advisory scopes; propagate project or fail closed, without changing routes before confirmation. |
| `tests/` | Modify/Create | Mocked contracts, diagnostic, and `tests/package-validation.mjs`; live mutation opt-in. |
| `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `GUIA.md`, `package.json` | Modify | Document migration, diagnostics, tests, and validation. The three docs are repository-only; `files` publishes only `dist/**`, `LICENSE`, and `README.md`. |

## Interfaces / Contracts

`RequestContext` contains only verified project identity required by the backend contract. Classification uses confirmed semantics; unknown responses receive generic guidance. Redaction removes token, password, `Authorization`, endpoint configuration, raw details, and credential-like values. `redactEndpointForDiagnostic()` returns a constant label.

Implementation is gated on backend confirmation of API-key `401`/`403` codes and project route/resolver semantics. Do not invent either contract.

## Testing Strategy

| Layer | What to Test | Exact approach |
|---|---|---|
| Contract | Bearer-once, missing/no-fetch, no legacy/retry, failures, redaction, cache, context. | Mock `fetch`; inspect requests/results; write RED tests first. |
| Diagnostics | Startup endpoint safety. | Test `redactEndpointForDiagnostic()` from `src/config.ts` (or extracted helper) with URL userinfo/query/token values; assert none appear and stderr is the only stream. |
| Integration | Non-mutating smoke checks. | Explicit opt-in; excluded from `pnpm test`. Mutations use `TASKHUB_MCP_LIVE=1 pnpm vitest run tests/live.test.ts`. |
| Package | Build, allowlist, entrypoint, docs. | Run `pnpm run build && pnpm exec tsc --noEmit && pnpm run test:package`. Assert `dist/index.js` exists, `node --check dist/index.js` passes, and `pnpm pack --dry-run --json` contains only `dist/**`, `LICENSE`, `README.md` (not repository docs, source, tests, or OpenSpec). Assert `main`, `exports`, and `bin.taskhub-mcp` equal `./dist/index.js`; README uses `TASKHUB_API_TOKEN`; all four docs state environment-only, no persistence, and no refresh, with no login setup. |

## Threat Matrix

| Boundary | Applicability | Safe/failure behavior and RED test |
|---|---|---|
| Documentation-like paths | N/A — docs are not executed or command-classified. | No test. |
| Git repository selection | N/A — no Git selection change. | No test. |
| Commit state | N/A — no commit change. | No test. |
| Push state | N/A — no push or refspec change. | No test. |
| PR commands | N/A — no PR/subprocess composition change. | No test. |

## Migration / Rollout

Confirm contract → add RED mocks → replace credential root → centralize failures → implement context policy → update docs → validate package. Users create, configure, validate, and replace keys; legacy files are ignored, never converted. Rollback reverts source and republishes the prior version; credentials are never copied.

## Open Questions

- [ ] Confirm backend API-key `401`/`403` codes and project-binding/route-resolution semantics before implementation.
- [ ] Confirm whether a server project resolver exists; otherwise retain the confirmed explicit-context/fail-closed contract.
