# Proposal: TaskHub MCP API-Key Authentication

## Intent

Replace password/JWT authentication with a strict, environment-only static bearer token. Remove password handling, credential-file leakage, and refresh complexity while preserving server-authoritative scopes and project access.

## Scope

### In Scope
- Make `TASKHUB_API_TOKEN` the only opaque credential; remove `taskhub_login`, legacy credential-file persistence, JWT refresh state, and retries.
- Classify `401`/`403` into actionable, secret-safe guidance; redact tokens, passwords, headers, endpoint configuration, and unsafe backend details.
- Keep `taskhub_whoami` metadata-only; define effective-project propagation so local context cannot override server key binding.
- Add mocked contract tests for missing/invalid/expired/revoked tokens, scope/project denial, redaction, and no refresh; make mutating live tests opt-in.
- Update README, SECURITY, ARCHITECTURE, GUIA, package validation, and published-package checks.

### Out of Scope
- Changes to backend, Admin, taskboard-plugin, TaskBoard TUI, TaskHub data, production, credentials, or deployment.
- Backward-compatible dual authentication or silent JWT-to-key conversion.

## Capabilities

### New Capabilities
- `mcp-api-key-auth`: Environment-only API-key transport, failure handling, migration, and project-context contract for MCP tools.

### Modified Capabilities
- None; `openspec/specs/` currently contains no existing capability specifications.

## Approach

Refactor the composition root and HTTP boundary around one in-memory token sourced only from `TASKHUB_API_TOKEN`. Preserve HTTPS, advisory scope preflight, and metadata-only identity/context reporting; backend authorization remains authoritative. Classify `401`/`403` only after confirming exact backend API-key codes and project-resolution semantics. Use mocked fetch contracts by default and gate live mutation behind explicit opt-in. This breaking migration requires replacement project-bound keys.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/{config,auth,api-client,scopes,types}.ts` | Modified | Static-token lifecycle, safe errors, authoritative authorization. |
| `src/tools/`, `src/context.ts`, `tests/` | Modified | Remove login, enforce context, add contracts. |
| `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `GUIA.md`, `package.json` | Modified | Document and validate the new contract. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing installations fail after removal. | High | Document create/configure/validate/revoke-and-replace; never convert JWTs. |
| Local context conflicts with key binding. | Med | Require explicit context, fail closed, and confirm the backend contract. |
| Errors leak secrets or internals. | Med | Centralize redaction and test adversarial payloads. |

## Rollback Plan

Revert the taskhub-mcp change and republish the prior package, restoring legacy login/file/refresh behavior only from versioned source. Never restore or copy credentials; users reconfigure the environment or use an existing file.

## Dependencies

- Backend confirmation of API-key `401`/`403` codes and project-binding/route-resolution semantics.

## Success Criteria

- [ ] Only `TASKHUB_API_TOKEN` can supply the bearer credential; no password, credential-file, or refresh path remains.
- [ ] Contract tests prove classification, redaction, no refresh, scope preflight, and fail-closed project behavior.
- [ ] Documentation and package validation describe the breaking migration and live-test opt-in accurately.
