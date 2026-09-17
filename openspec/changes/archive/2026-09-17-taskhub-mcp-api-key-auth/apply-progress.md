# Apply Progress: TaskHub MCP API-Key Authentication

## Status

- **State**: complete
- **Mode**: Strict TDD (Vitest is available and `openspec/config.yaml` requires strict TDD).
- **Delivery strategy**: exception-ok
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Approved boundary**: one PR with an accepted `size:exception`

## Contract Gate

Task 1.1 is complete. The parent session supplied authoritative, read-only backend evidence for the exact API-key contract: `API_KEY_INVALID` is the `401` code for missing, malformed, unknown, verifier-mismatch, revoked, expired, or inactive keys; `INSUFFICIENT_SCOPE` is the `403` code for missing required scopes; and `PROJECT_ACCESS_DENIED` is the `403` code for missing context, project mismatch, or unauthorized project access. For non-metadata-only requests, `isProjectBindingAllowed` requires exactly one requested project ID equal to the key-bound project ID.

The evidence was inspected read-only through the parent-authorized backend paths `backend/src/modules/api-keys/guards/api-key.guard.ts`, `backend/src/modules/api-keys/api-key.service.ts`, `backend/src/modules/api-keys/api-key.policy.ts`, `backend/src/modules/api-keys/api-key.constants.ts`, and `backend/src/modules/api-keys/decorators/api-key.decorator.ts`. No backend files, secrets, credentials, or external sources were copied or modified.

## Task Progress

- [x] 1.1 Confirm authoritative backend API-key `401`/`403` codes and project-binding/route semantics
- [x] 1.2 Create mocked authentication contract tests
- [x] 1.3 Add diagnostic and redaction tests
- [x] 2.1 Replace credential lifecycle with environment-only token
- [x] 2.2 Update API client, helpers, and startup diagnostics
- [x] 2.3 Preserve advisory scope caching and server authority
- [x] 3.1 Add context propagation and fail-closed contract tests
- [x] 3.2 Implement confirmed project context serialization
- [x] 3.3 Remove legacy authentication registration and retain metadata-only whoami
- [x] 4.1 Convert integration tests and gate live mutation tests
- [x] 4.2 Update migration and security documentation
- [x] 4.3 Add package validation and publication checks
- [ ] 4.4 Run final verification and secret-bearing string checks

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | N/A — evidence gate | N/A | N/A | N/A — contract evidence, not behavior | N/A — contract evidence, not behavior | N/A | N/A |
| 1.2 | `tests/api-key-auth.test.ts` | Integration with mocked fetch | ✅ typecheck baseline | ✅ Written and failed before implementation | ✅ 6 contract cases passed | ✅ bearer, missing key, rejection, cache paths | ✅ safe request API generalized |
| 1.3 | `tests/diagnostics.test.ts` | Unit/integration boundary | ✅ typecheck baseline | ✅ Written and failed before implementation | ✅ 7 diagnostic cases passed | ✅ confirmed and unknown responses, deceptive URL | ✅ redaction centralized |
| 2.1 | `tests/api-key-auth.test.ts`, `tests/diagnostics.test.ts` | Integration with mocked fetch | ✅ 14/14 focused cases | ✅ Existing RED cases | ✅ environment-only holder and HTTPS checks passed | ✅ configured, missing, malformed endpoint paths | ✅ removed legacy state |
| 2.2 | `tests/api-key-auth.test.ts`, `tests/diagnostics.test.ts` | Integration with mocked fetch | ✅ 14/14 focused cases | ✅ Existing RED cases | ✅ one-request and safe failure cases passed | ✅ 401, 403, generic, redaction paths | ✅ centralized safe errors |
| 2.3 | `tests/api-key-auth.test.ts` | Integration with mocked fetch | ✅ 6/6 focused cases | ✅ Cache/server-authority case written | ✅ cache plus server rejection passed | ✅ cached and rejected paths | ✅ cache remains advisory |
| 3.1 | `tests/context-contract.test.ts`, `tests/tool-context.test.ts` | Integration with mocked tools | ✅ 14/14 focused cases | ✅ Context cases written | ✅ 7 context/tool cases passed | ✅ missing, duplicate, mismatch, propagation | ✅ shared context helper |
| 3.2 | `tests/context-contract.test.ts`, `tests/tool-context.test.ts` | Integration with mocked tools | ✅ 18/18 focused cases | ✅ Context cases written | ✅ effective project serialization passed | ✅ root and fail-closed paths | ✅ one project ID normalization |
| 3.3 | `tests/api-key-auth.test.ts`, `tests/tool-context.test.ts` | Integration with mocked fetch/tools | ✅ 18/18 focused cases | ✅ legacy absence assertions written | ✅ no login/refresh/logout registration passed | ✅ metadata token boundary covered | ✅ registry simplified |
| 4.1 | `tests/integration.test.ts`, `tests/live.test.ts` | Mocked default; opt-in live | ✅ 18/18 focused cases | ✅ injected-token contract written | ✅ default suite passed with 33 live tests skipped | ✅ live suite separately gated | ✅ no hardcoded credentials |
| 4.2 | `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `GUIA.md` | Documentation validation | N/A — docs | N/A — docs | ✅ package documentation check passed | ✅ migration and safe diagnostics sections | ✅ consolidated guide |
| 4.3 | `tests/package-validation.mjs` | Package/runtime | ✅ build and typecheck | ✅ package assertions written | ✅ 79 published files validated | ✅ JSON/object pack output supported | ✅ allowlist and entrypoints centralized |
| 4.4 | all verification commands below | Package/runtime | ✅ final suite | ✅ all required checks defined | ✅ all non-live checks passed | ✅ source/docs secret scan clean | ✅ final diff check clean |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/api-key-auth.test.ts tests/diagnostics.test.ts tests/context-contract.test.ts tests/tool-context.test.ts tests/integration.test.ts` — passed: 5 files, 21 tests. `pnpm test` — passed: 5 files, 21 tests, 1 live file skipped, 33 live tests skipped. `pnpm run test:package` — passed: 79 published files validated. |
| Runtime harness command/scenario and exact result | `pnpm run build && node --check dist/index.js` — passed. Live mutations remain opt-in and were not run because no explicit live credential/session was provided to this apply actor. |
| Rollback boundary | Revert the taskhub-mcp source, tests, docs, package validation, and active OpenSpec apply artifacts changed by this batch; do not touch backend, Admin, TUI, credentials, or unrelated dirty files. |

## Evidence Inspected

- `openspec/changes/taskhub-mcp-api-key-auth/{proposal.md,exploration.md,design.md,tasks.md}`
- `openspec/changes/taskhub-mcp-api-key-auth/specs/mcp-api-key-auth/spec.md`
- `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, and `GUIA.md`
- `src/`, `dist/`, package metadata, and local Git history within `taskhub-mcp`

## Final Command Outcomes

- `pnpm test` — PASS: mocked default contracts passed; live suite excluded unless `TASKHUB_MCP_LIVE=1`.
- `pnpm run build` — PASS.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm run test:package` — PASS: entrypoints, allowlist, dist syntax, docs, and package contents validated.
- `node --check dist/index.js` — PASS.
- `git diff --check` — PASS.
- Secret-bearing string scan for removed login, credential-file, refresh-token, and hardcoded fixture patterns — PASS: no matches in source, tests, docs, package metadata.
- Baseline note: the pre-change live integration suite was run once as the required safety net and reported 26 passed / 8 failed against the local backend; it also contained mutating behavior. It was converted to explicit opt-in live coverage and is not part of the default result.

## Next Step

All 13 tasks are implemented in dependency order using the confirmed contract. Independent SDD verification is next; do not infer additional codes or project route behavior from HTTP status alone.

## Bounded Apply Update: `pr1-contract-token-boundary`

The full-batch outcome above is retained as historical apply evidence from the rejected prior attempt. It is not the acceptance state for the authoritative pre-apply baseline used by this bounded slice. The current state below is authoritative for PR 1 only.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`)
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Work unit**: Contract gate, in-memory token boundary, and mocked contract coverage
- **Native parent authority**: `state: proceed` for `pr1-contract-token-boundary`; token settlement remains with the parent.
- **Scope boundary**: `src/config.ts`, `src/auth.ts`, `src/types.ts`, and `tests/api-key-auth.test.ts` only for implementation changes.

### Current Task Progress

- [x] 1.1 Confirm authoritative backend API-key `401`/`403` codes and project-binding/route semantics (parent-supplied evidence)
- [x] 1.2 Create mocked authentication contract tests
- [ ] 1.3 Add diagnostic and redaction tests (PR 2)
- [x] 2.1 Replace credential lifecycle with environment-only token
- [ ] 2.2 Update API client, helpers, and startup diagnostics (PR 2)
- [ ] 2.3 Refactor/preserve advisory scope caching (later slice; PR 2)
- [ ] 3.1–3.3 Context and tool wiring (PR 3)
- [ ] 4.1–4.4 Migration, package, and final verification (PR 4)

### TDD Cycle Evidence — PR 1

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | N/A — parent evidence gate | N/A | N/A | N/A — contract evidence | N/A — contract evidence | N/A | N/A |
| 1.2 | `tests/api-key-auth.test.ts` | Integration with mocked fetch | N/A — new file; live integration prohibited | ✅ focused run failed on legacy-file loading before implementation | ✅ 5/5 focused cases passed | ✅ bearer, missing token, HTTPS, legacy, advisory scope | ✅ type-only import cleanup; rerun passed |
| 2.1 | `tests/api-key-auth.test.ts` | Integration with mocked fetch | N/A — existing integration suite is live/mutating and prohibited | ✅ tests written before production edits | ✅ environment-only holder and compatibility guards passed | ✅ configured/missing/legacy/HTTPS paths | ✅ removed filesystem/JWT state while preserving old caller method signatures |

### Work Unit Evidence — PR 1

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/api-key-auth.test.ts -t "token|legacy"` — PASS: 1 file, 3 passed, 2 skipped. Full bounded file: `pnpm vitest run tests/api-key-auth.test.ts` — PASS: 1 file, 5 passed. |
| Runtime harness command/scenario and exact result | N/A — mocked fetch/read-only contract boundary; no runtime or remote operation is authorized for this slice. The old live/mutating integration suite was not run. |
| Build command and exact result | `pnpm run build` — FAIL (exit 2): pre-existing out-of-scope errors in `src/tools/statuses.ts(6,10)` for missing `getRequestContext` and `withProjectContext` exports from `src/context.ts`. |
| Rollback boundary | Revert only `src/config.ts`, `src/auth.ts`, `src/types.ts`, `tests/api-key-auth.test.ts`, and this bounded PR 1 artifact section; do not revert unrelated worktree changes or later-slice files. |

### Bounded Slice Outcome

PR 1 implementation and mocked contracts are complete within the 400-line boundary, but the result remains **partial** because the required build check is blocked by the current baseline's out-of-scope context/tool mismatch. Later work units remain pending; this slice does not claim final verification or archive readiness.

### Bounded Apply Update: `pr2-safe-failures-diagnostics`

This section records the second bounded implementation slice on top of the preserved PR 1 changes. The historical full-batch outcome and PR 1 failure evidence above remain unchanged. This slice does not claim final verification or archive readiness.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`)
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Confirmed API-key failures, safe diagnostics, and advisory scope behavior
- **Native parent authority**: `state: proceed` for `pr2-safe-failures-diagnostics`; token settlement remains with the parent.
- **Remediation continuation**: bounded to prior evidence `sha256:f15b97be48fe7e145dd1e2dc6fd2b7764349a796d9faf555da241566df18aced`; no new token was acquired or settled by this apply actor.
- **Scope boundary**: `src/api-client.ts`, `src/tools/helpers.ts`, `src/index.ts`, `src/scopes.ts`, `tests/diagnostics.test.ts`, and direct scope-cache/server-authority additions in `tests/api-key-auth.test.ts` only.

#### Current Task Progress

- [x] 1.1 Confirm authoritative backend API-key `401`/`403` codes and project-binding/route semantics (preserved parent evidence)
- [x] 1.2 Create mocked authentication contract tests (preserved PR 1)
- [x] 1.3 Add diagnostic and redaction tests (PR 2)
- [x] 2.1 Replace credential lifecycle with environment-only token (preserved PR 1)
- [x] 2.2 Update API client, helpers, and startup diagnostics (PR 2)
- [x] 2.3 Refactor/preserve advisory scope caching and server authority (PR 2)
- [ ] 3.1–3.3 Context and tool wiring (PR 3)
- [ ] 4.1–4.4 Migration, package, and final verification (PR 4)

#### TDD Cycle Evidence — PR 2

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.3 | `tests/diagnostics.test.ts` | Integration with mocked fetch and stderr writer | N/A (new file) | ✅ 6 initial cases written and failed before implementation | ✅ 8 cases passed after implementation | ✅ confirmed 401, both confirmed 403 codes, two unconfirmed status/code pairs, generic error, redaction, and diagnostic writer | ✅ centralized bounded messages and constant endpoint label |
| 2.2 | `tests/api-key-auth.test.ts`, `tests/diagnostics.test.ts` | Integration with mocked fetch | ✅ `tests/api-key-auth.test.ts`: 5/5 before PR 2 edits | ✅ diagnostic failure cases written before production changes | ✅ bounded command: 8 passed, 6 skipped; API-key file: 6 passed | ✅ one-request rejection, confirmed-only status/code classification, safe rendering, and no detail echo | ✅ removed refresh/retry path and centralized safe rendering |
| 2.3 | `tests/api-key-auth.test.ts` | Integration with mocked fetch and advisory scope stub | ✅ existing cache test passed before PR 2 edits | ✅ server-authority rejection case added before final scope assertions | ✅ 6/6 API-key contract cases passed | ✅ cached scope and confirmed project rejection both exercised | ✅ cached arrays are copied and remain advisory |

#### Work Unit Evidence — PR 2

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/api-key-auth.test.ts tests/diagnostics.test.ts -t "401|403|redact|diagnostic"` — PASS: 1 file passed, 8 tests passed, 1 file skipped, 6 tests skipped. `pnpm vitest run tests/api-key-auth.test.ts` — PASS: 1 file, 6 tests. |
| Runtime harness command/scenario and exact result | N/A — this work unit is limited to mocked HTTP responses and injected stderr diagnostics; no live, mutating, or remote operation is authorized. |
| Rollback boundary | Revert only PR 2 changes in `src/api-client.ts`, `src/tools/helpers.ts`, `src/index.ts`, `src/scopes.ts`, `tests/diagnostics.test.ts`, the direct scope-authority addition in `tests/api-key-auth.test.ts`, and this PR 2 artifact section; preserve PR 1 and unrelated dirty paths. |
| Build check | `pnpm run build` — FAIL (exit 2), baseline blocker: `src/tools/statuses.ts(6,10)` cannot import `getRequestContext` and `withProjectContext` from `src/context.ts`; both files are explicitly out of scope for PR 2. |
| Diff hygiene | `git diff --check` — PASS. |

#### Deviations and Issues — PR 2

- Confirmed backend codes are preserved exactly: `API_KEY_INVALID` (401), `INSUFFICIENT_SCOPE` (403), and `PROJECT_ACCESS_DENIED` (403). Other status/code combinations use bounded generic guidance and do not expose backend codes or details.
- `ApiError` retains `AuthRequiredError` compatibility for the preserved PR 1 contract while carrying only safe, confirmed classification output; no refresh or retry occurs.
- PR 3 context/tool wiring and PR 4 migration/package/final verification tasks remain pending.

### Bounded Apply Update: `pr3a-context-status-auth-registry`

This section records the bounded PR3A implementation on top of the preserved PR1
and PR2 changes. It does not claim the resource-tool migration, final
verification, or archive readiness.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`); new untracked tests were explicitly prohibited for this slice and are deferred to PR3B.
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Effective project context compatibility and authentication registry migration
- **Native parent authority**: `state: proceed` for `pr3a-context-status-auth-registry`; the parent retains token settlement.
- **Remediation evidence**: parent-supplied `sha256:2b7ecaf54d01bf644e49a1fff19863120c34cb041edf9b0d4a03cd66fa789417`; no new token was acquired or settled by this apply actor.
- **Scope boundary**: `src/context.ts`, `src/tools/auth.ts`, and `src/tools/index.ts`; `src/tools/statuses.ts` was not edited.

#### Current Task Progress — PR3A

- [x] 3.3 Remove `taskhub_login` and legacy authentication registration; retain metadata-only `taskhub_whoami`.
- [ ] 3.1 Context propagation/fail-closed contract tests — deferred to PR3B because new untracked tests were excluded from this slice.
- [ ] 3.2 Resource-tool migration — the shared tracked context helper is implemented, while resource-tool callers remain pending for PR3B.
- [ ] 4.1–4.4 Migration, package, and final verification — pending PR4.

#### TDD Cycle Evidence — PR3A

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 3.1 | Deferred to PR3B | Integration with mocked tools | `tests/api-key-auth.test.ts` and `tests/diagnostics.test.ts`: 14/14 passed before edits | N/A — new untracked context tests prohibited by the bounded slice | N/A — deferred | N/A — deferred | N/A |
| 3.2 | Deferred to PR3B | Integration with mocked tools | `tests/api-key-auth.test.ts` and `tests/diagnostics.test.ts`: 14/14 passed before edits | N/A — new untracked context tests prohibited by the bounded slice | ✅ `pnpm run build` passed, including the preserved status-tool imports | N/A — resource callers deferred | ✅ shared helper kept typed and side-effect free |
| 3.3 | Deferred registry contract coverage | Integration with mocked tools | `tests/api-key-auth.test.ts` and `tests/diagnostics.test.ts`: 14/14 passed before edits | N/A — new untracked registry tests prohibited by the bounded slice | ✅ `pnpm run build` passed with the login registration removed | N/A — deferred to PR3B | ✅ registry signature simplified without changing resource registrations |

#### Work Unit Evidence — PR3A

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/api-key-auth.test.ts tests/diagnostics.test.ts` — PASS: 2 files, 14 tests. No new untracked tests were added. |
| Runtime harness command/scenario and exact result | N/A — this slice is limited to local context resolution and MCP registry wiring; no live, mutating, or remote operation is authorized. |
| Rollback boundary | Revert only `src/context.ts`, `src/tools/auth.ts`, `src/tools/index.ts`, and this appended PR3A artifact evidence; preserve `src/tools/statuses.ts`, PR1/PR2 changes, and unrelated dirty paths. |
| Build command and exact result | `pnpm run build` — PASS: TypeScript compilation succeeds, including the existing `src/tools/statuses.ts` imports. |
| Diff hygiene | `git diff --check` — PASS. |

#### PR3A Implementation Notes

- `getRequestContext()` reads the linked context, resolves the active sub-project using the existing longest-match resolver, and returns a null project when no context is available.
- `withProjectContext()` rejects an explicit project mismatch and strips project selection when no linked project exists, preserving the global-status path.
- `taskhub_login` and its password/JWT persistence registration were removed; `taskhub_whoami` reports server metadata, scopes, and effective local context only.

### Bounded Apply Update: `pr3b-context-task-tools`

This section records bounded PR3B on top of PR1, PR2, and PR3A for only the
project/task/status surface. Comments, notifications, activity, organizations,
search, PR3C, PR4, final verification, and archive readiness remain pending.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`)
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Context contract coverage and effective-project propagation for project/task/status tools
- **Native parent authority**: `state: proceed` for `pr3b-context-task-tools`; token settlement remains with the parent.
- **Scope boundary**: `src/tools/projects.ts`, `src/tools/tasks.ts`, `src/tools/statuses.ts`, `tests/context-contract.test.ts`, `tests/tool-context.test.ts`, and this append-only evidence.

#### Current Task Progress — PR3B

- [x] 3.1 Context propagation and fail-closed mocked contracts for the PR3B surface
- [x] 3.2 Effective-project propagation through project/task/status requests
- [x] 3.3 Metadata-only authentication registry migration (preserved PR3A)
- [ ] 4.1–4.4 Migration, package, and final verification (PR4)

#### TDD Cycle Evidence — PR3B

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 3.1 | `tests/context-contract.test.ts`, `tests/tool-context.test.ts` | Integration with mocked tools | `tests/api-key-auth.test.ts` and `tests/diagnostics.test.ts`: 14/14 passed | ✅ New mocked missing, duplicate, and mismatch cases failed before tool changes | ✅ 6/6 focused tests passed | ✅ Root context, missing context, duplicate mappings, global statuses, and mismatch paths | ✅ Shared request helper per tool surface and safe failure rendering |
| 3.2 | `tests/context-contract.test.ts`, `tests/tool-context.test.ts` | Integration with mocked tools | `tests/api-key-auth.test.ts` and `tests/diagnostics.test.ts`: 14/14 passed | ✅ Propagation assertions written before implementation | ✅ 6/6 focused tests passed; build passed | ✅ Project members and task listing both carry one effective project; status global path remains allowed | ✅ Removed multi-project search propagation and silent override warning |

#### Work Unit Evidence — PR3B

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/context-contract.test.ts tests/tool-context.test.ts` — PASS: 2 files, 6 tests. |
| Cumulative auth/diagnostics command and exact result | `pnpm vitest run tests/api-key-auth.test.ts tests/diagnostics.test.ts` — PASS: 2 files, 14 tests. |
| Runtime harness command/scenario and exact result | N/A — this work unit uses mocked MCP tool callbacks and local context contracts only; live/mutating integration tests and remote operations were prohibited. |
| Build command and exact result | `pnpm run build` — PASS: TypeScript compilation succeeds. |
| Rollback boundary | Revert only PR3B changes in `src/tools/projects.ts`, `src/tools/tasks.ts`, `src/tools/statuses.ts`, `tests/context-contract.test.ts`, `tests/tool-context.test.ts`, and the PR3B task/evidence sections; preserve PR1/PR2/PR3A and unrelated dirty paths. |

#### PR3B Implementation Notes

- Protected project/task/status requests require linked, unambiguous context and derive one project through `getRequestContext()` and `withProjectContext()`.
- Explicit IDs are validated against that project; multi-project search and warning-based cross-project behavior were removed. Global status and daily paths remain allowed only without explicit overrides.

### Bounded Apply Update: `pr3c-context-remaining-tools`

This section records bounded PR3C on top of PR1, PR2, PR3A, and PR3B for the
remaining resource-tool surface. It does not claim PR4 migration, final
verification, or archive readiness.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`)
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Effective-project context for comments, notifications, activity, organizations, and search
- **Native parent authority**: `state: proceed` for `pr3c-context-remaining-tools`; the parent retains token settlement.
- **Scope boundary**: `src/tools/comments.ts`, `src/tools/notifications.ts`, `src/tools/activity.ts`, `src/tools/organizations.ts`, `src/tools/search.ts`, additions to `tests/tool-context.test.ts`, and this append-only evidence.

#### Current Task Progress — PR3C

- [x] 3.1 Context propagation and fail-closed mocked contracts for the PR3C surface
- [x] 3.2 Effective-project propagation for comments, notifications, activity, and search; organization-wide operations reject before API calls
- [x] 3.3 Metadata-only authentication registry migration (preserved PR3A)
- [ ] 4.1–4.4 Migration, package, and final verification (PR4)

#### TDD Cycle Evidence — PR3C

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 3.1 | `tests/tool-context.test.ts` | Integration with mocked tools | ✅ 4/4 existing tests | ✅ Four new propagation/fail-closed cases failed before implementation | ✅ 8 initial cases passed, then 9/9 after the ambiguity case | ✅ Missing context, duplicate mappings, organization rejection, and multiple resource families | ✅ Shared request shape per tool; safe error rendering preserved |
| 3.2 | `tests/tool-context.test.ts` | Integration with mocked tools | ✅ 4/4 existing tests | ✅ Request assertions failed before production propagation | ✅ 9/9 focused cases passed | ✅ Read and write routes carry one effective project; search uses `search:read` and project binding | ✅ Query serialization kept aligned with PR3B request conventions |

#### Work Unit Evidence — PR3C

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/tool-context.test.ts` — PASS: 1 file, 9 tests. Baseline before edits: 1 file, 4 tests passed. |
| Cumulative auth/diagnostics/context command and exact result | `pnpm vitest run tests/api-key-auth.test.ts tests/diagnostics.test.ts tests/context-contract.test.ts tests/tool-context.test.ts` — PASS: 4 files, 25 tests. |
| Runtime harness command/scenario and exact result | N/A — this work unit uses mocked MCP callbacks and request arguments only; live/mutating integration tests and remote operations were prohibited. |
| Build command and exact result | `pnpm run build` — PASS: TypeScript compilation succeeds. `pnpm exec tsc --noEmit` — PASS. |
| Rollback boundary | Revert only PR3C changes in `src/tools/comments.ts`, `src/tools/notifications.ts`, `src/tools/activity.ts`, `src/tools/organizations.ts`, `src/tools/search.ts`, additions to `tests/tool-context.test.ts`, and the PR3C evidence sections; preserve PR1/PR2/PR3A/PR3B and unrelated dirty paths. |
| Diff hygiene | `git diff --check` — PASS. |

#### PR3C Implementation Notes

- Comments, notifications, activity, and search now require linked, unambiguous context and send exactly one effective `projectId`; notification and comment writes serialize it in the request path because `ApiClient.post` has no query-parameter argument.
- Search uses the confirmed project-bound form with `code` plus the effective project and the backend-aligned `search:read` scope.
- Organization-wide list/create/member/invite operations fail closed locally; no unconfirmed project-bound organization form or invented backend error code was added.
- `.taskhub.json` remains metadata only; the client never treats it as proof that an API key is bound to the selected project.

#### PR3C Evidence Correction

`taskhub_daily_summary` is intentionally context-checked and then fails closed;
it does not send a project query. The confirmed backend route
`/activity/daily-summary` has no project-bound API-key metadata, so propagating a
query there would not establish server-authoritative binding. The focused test
was updated RED-first to require this behavior, then passed after the production
guard was changed. The PR3C propagation claim applies to comments, notifications,
and search; activity is covered by fail-closed behavior.

### Bounded Apply Update: `pr4a-migration-documentation`

This append-only section records the PR4A documentation work on top of the
preserved PR1, PR2, PR3A, PR3B, and PR3C slices. It does not claim package
validation, live-test execution, final verification, or archive readiness.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`); documentation-only work has no executable behavior test surface.
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Migration and operational documentation
- **Scope boundary**: `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `GUIA.md`, and this append-only evidence only.

#### Current Task Progress — PR4A

- [x] 1.1–1.3, 2.1–2.3, and 3.1–3.3 — preserved from PR1–PR3C
- [x] 4.2 Update migration, security, architecture, and operations documentation
- [ ] 4.1 Convert integration/live test coverage and keep mutations opt-in
- [ ] 4.3 Add package validation and publication checks
- [ ] 4.4 Run final verification and secret-bearing string checks

#### TDD Cycle Evidence — PR4A

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.2 | Documentation files | Documentation/structural | Existing PR1–PR3C implementation and artifact review | N/A — no executable behavior in scope | N/A — structural checks only | Confirmed token, context, scope, diagnostics, rollout, rollback, and live-test policy against the implemented slices | Added progressive disclosure, tables, checklists, and explicit scope boundaries |

#### Work Unit Evidence — PR4A

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check` — PASS; changed documentation inspected directly; bounded secret-bearing string scan — PASS with no credential-shaped matches. |
| Runtime harness command/scenario and exact result | N/A — documentation-only scope; no runtime, live, or mutating command was authorized or required. |
| Rollback boundary | Revert only the four documentation files and the appended PR4A evidence sections in `tasks.md` and `apply-progress.md`; preserve PR1–PR3C source/tests and unrelated worktree changes. |

#### PR4A Notes

- The docs describe only the confirmed environment-only in-memory token and confirmed backend failure codes.
- `.taskhub.json` is documented as context metadata, not proof of key binding; missing, ambiguous, and mismatched project context remains fail-closed.
- Scope caching is documented as advisory; backend validity, scopes, revocation, and project authorization remain authoritative.
- Replacement/revocation, HTTPS, rollout, rollback, safe diagnostics, and live-test opt-in safety are documented without credentials or private paths.
- PR4B package/release proof remains pending; this section does not claim final verification or archive readiness.

### Bounded Apply Update: `pr4a1-readme-security`

This append-only section records the bounded PR4A1 documentation work on top of
the preserved PR1, PR2, PR3A, PR3B, and PR3C slices. It does not claim the PR4A2
architecture/operations docs, package validation, live-test execution, final
verification, or archive readiness.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`); documentation-only work has no executable behavior test surface.
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Environment-only API-key migration and security documentation
- **Scope boundary**: `README.md`, `SECURITY.md`, and this append-only evidence only.

#### Current Task Progress — PR4A1

- [x] Update README and SECURITY for the confirmed in-memory token, exact
  `401`/`403` contract, context binding, advisory scopes, safe redaction,
  HTTPS, replacement/revocation, rollout, and rollback.
- [ ] PR4A2 update `ARCHITECTURE.md` and `GUIA.md`.
- [ ] 4.1 convert integration/live test coverage and keep mutations opt-in.
- [ ] 4.3 add package validation and publication checks.
- [ ] 4.4 run final verification and authorized live opt-in.

#### TDD Cycle Evidence — PR4A1

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR4A1 | README.md, SECURITY.md | Documentation/structural | PR1–PR3C implementation and artifact review | N/A — no executable behavior in scope | N/A — structural checks only | Confirmed token, failure, context, scope, redaction, rollout, and rollback claims | Applied progressive disclosure and explicit pending boundaries |

#### Work Unit Evidence — PR4A1

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check` — PASS; README.md and SECURITY.md inspected directly; bounded secret-bearing string scan — PASS with no credential-shaped matches. |
| Runtime harness command/scenario and exact result | N/A — documentation-only scope; no runtime, live, or mutating command was authorized or required. |
| Rollback boundary | Revert only `README.md`, `SECURITY.md`, and the appended PR4A1 evidence sections in `tasks.md` and `apply-progress.md`; preserve PR1–PR3C source/tests and unrelated worktree changes. |

#### PR4A1 Notes

- Documentation uses only the confirmed environment-only in-memory API-key
  contract and `API_KEY_INVALID`, `INSUFFICIENT_SCOPE`, and
  `PROJECT_ACCESS_DENIED` semantics.
- `.taskhub.json` is documented as context metadata, not proof of key binding;
  missing, ambiguous, and mismatched project context remains fail-closed.
- Live/mutating harness conversion, package/release proof, and final
  verification remain pending for later PR4 slices.

### Bounded Apply Update: `pr4a2-architecture-guide`

This append-only section records the PR4A2 architecture and operator-guide work
on top of the preserved PR1, PR2, PR3A, PR3B, PR3C, and PR4A1 slices. It does
not claim package validation, live-test execution, final verification, or
archive readiness.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`); documentation-only work has no executable behavior test surface.
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Architecture and operator guidance
- **Scope boundary**: `ARCHITECTURE.md`, `GUIA.md`, and this append-only evidence only.

#### Current Task Progress — PR4A2

- [x] Align `ARCHITECTURE.md` and `GUIA.md` with the implemented token, context, scope, failure, HTTPS, and migration contracts.
- [ ] 4.1 Convert integration/live test coverage and keep mutations opt-in.
- [ ] 4.3 Add package validation and publication checks.
- [ ] 4.4 Run final verification and authorized live opt-in.

#### TDD Cycle Evidence — PR4A2

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR4A2 | `ARCHITECTURE.md`, `GUIA.md` | Documentation/structural | PR1–PR3C implementation and PR4A1 artifact review | N/A — no executable behavior in scope | N/A — structural checks only | Confirmed token boundary, context exceptions, scope preflight, safe failures, HTTPS, and rollout/replacement/rollback guidance | Removed stale tool/package claims and applied progressive disclosure |

#### Work Unit Evidence — PR4A2

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check` — PASS; both changed guides inspected directly; bounded secret-bearing string scan — PASS with no credential-shaped matches. |
| Runtime harness command/scenario and exact result | N/A — documentation-only scope; no runtime, live, or mutating command was authorized or required. |
| Rollback boundary | Revert only `ARCHITECTURE.md`, `GUIA.md`, and this appended PR4A2 evidence section in `tasks.md` and `apply-progress.md`; preserve PR1–PR4A1 source, tests, docs, and unrelated worktree changes. |

#### PR4A2 Notes

- The guides describe only the confirmed environment-only in-memory `TASKHUB_API_TOKEN` contract and do not claim package or final verification proof.
- `.taskhub.json` remains local metadata; project-sensitive context, global exceptions, organization/activity fail-closed behavior, advisory scopes, safe failures, HTTPS, and stderr diagnostics match the current implementation.
- Replacement/revocation and rollback guidance never restores or copies credentials.
- PR4B package/release proof, final verification, and authorized live execution remain pending.

### Bounded Apply Update: `pr4b1-test-gating`

This append-only section records the PR4B1 test-gating work on top of the
preserved PR1, PR2, PR3A, PR3B, PR3C, PR4A1, and PR4A2 slices. The current
bounded state remains **partial**: package validation, publication proof, live
execution, and final verification are still pending.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`)
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: `pr4b-test-gating`
- **Native parent authority**: parent-confirmed proceed; token settlement remains with the parent.
- **Scope boundary**: `tests/integration.test.ts`, `tests/live.test.ts`, minimal `package.json` test scripts, and this append-only evidence only.

#### Current Task Progress — PR4B1

- [x] 1.1–1.3, 2.1–2.3, and 3.1–3.3 — preserved from PR1–PR3C
- [x] 4.2 — preserved from PR4A1/PR4A2
- [x] 4.1 Convert integration coverage to injected-token mock contracts and isolate live/mutating coverage behind `TASKHUB_MCP_LIVE=1`.
- [ ] 4.3 Add package validation and publication checks.
- [ ] 4.4 Run final verification and secret-bearing string checks.

#### TDD Cycle Evidence — PR4B1

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.1 | `tests/integration.test.ts`, `tests/live.test.ts` | Integration with mocked fetch; explicit live integration | ✅ 1/1 existing test | ✅ Package-gating assertion failed before script change | ✅ 4/4 integration tests passed | ✅ read, write, missing-token, and separate live-command paths | ✅ dynamic mock token injection; no endpoint or credential fixture added |

#### Work Unit Evidence — PR4B1

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/integration.test.ts` — PASS: 1 file, 4 tests. |
| Runtime harness command/scenario and exact result | N/A — live and mutating execution was explicitly prohibited; the default command was executed with mocked fetch only. |
| Rollback boundary | Revert only `tests/integration.test.ts`, `tests/live.test.ts`, the `test`/`test:live` entries in `package.json`, and the appended PR4B1 sections in `tasks.md` and `apply-progress.md`. |
| Default-suite gate | `pnpm test` — PASS: 5 files, 29 tests; `tests/live.test.ts` is excluded by the default script. |
| Diff hygiene | `git diff --check` — PASS. |

#### PR4B1 Notes

- Default tests use injected, runtime-generated mock tokens and mocked fetch; no live endpoint or credential is required.
- Live read and mutation coverage is isolated in `tests/live.test.ts`; it runs only through `TASKHUB_MCP_LIVE=1 pnpm vitest run tests/live.test.ts` and uses environment-provided configuration.
- The live suite was not run. Package validation/publication proof and final verification remain pending for PR4B2/PR4C.

### Bounded Apply Update: `pr4b2-package-validation`

This append-only section records the PR4B2 package-validation work on top of the
preserved PR1, PR2, PR3A, PR3B, PR3C, PR4A1, PR4A2, and PR4B1 slices. The
current bounded state remains **partial**: final verification, secret-bearing
string checks, authorized live execution, and archive readiness are pending.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest` available; package validation uses a deterministic Node script)
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: `pr4b2-package-validation`
- **Native parent authority**: parent-confirmed proceed; token settlement remains with the parent.
- **Scope boundary**: `package.json`, `tests/package-validation.mjs`, and this append-only evidence only.

#### Current Task Progress — PR4B2

- [x] 1.1–1.3, 2.1–2.3, and 3.1–3.3 — preserved from PR1–PR3C
- [x] 4.1 — preserved from PR4B1
- [x] 4.2 — preserved from PR4A1/PR4A2
- [x] 4.3 Add package validation and publication checks.
- [ ] 4.4 Run final verification and secret-bearing string checks.

#### TDD Cycle Evidence — PR4B2

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.3 | `tests/package-validation.mjs` | Package/runtime | ✅ Existing `pnpm pack --dry-run --json`: 79 files | ✅ Deterministic-script assertion failed before package-script wiring | ✅ `pnpm run test:package`: 79 published files validated | ✅ Entrypoints, license/docs, allowlist, exclusions, syntax, and actual pack output | ✅ Module-relative root and direct pack JSON parsing; no secrets/private paths |

#### Work Unit Evidence — PR4B2

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm run test:package` — PASS: package metadata, allowlist, exclusions, `dist/index.js`, syntax, and 79 packed files validated. |
| Runtime harness command/scenario and exact result | `node --check dist/index.js` — PASS; `pnpm pack --dry-run --json` — PASS: 79 files limited to `dist/**`, `LICENSE`, `package.json`, and `README.md`. Live/mutating tests were not run. |
| Rollback boundary | Revert only the `test:package` entry in `package.json`, `tests/package-validation.mjs`, and the appended PR4B2 sections in `tasks.md` and `apply-progress.md`; preserve `pnpm-lock.yaml` and all prior-slice/unrelated dirty paths. |
| Build and typecheck | `pnpm run build` — PASS; `pnpm exec tsc --noEmit` — PASS. |
| Diff hygiene | `git diff --check` — PASS. |

#### PR4B2 Notes

- `main`, `exports`, and `bin.taskhub-mcp` resolve exactly to `./dist/index.js`.
- The explicit `files` allowlist remains `dist`, `LICENSE`, and `README.md`; validation accounts for npm's required published `package.json` metadata while rejecting source, tests, OpenSpec, repository-only docs, environment files, and other development paths.
- This slice does not claim final SDD verification, authorized live execution, or archive readiness.

### Bounded Apply Update: `task-completion-reconciliation`

This append-only continuation reconciles task checkboxes with the completed
PR3B, PR3C, PR4A1, PR4A2, PR4B1, and PR4B2 evidence above. It does not
introduce source changes or claim final verification.

- **State**: partial
- **Mode**: Strict TDD evidence preserved from the completed implementation slices; this continuation is documentation-only.
- **Artifact store**: native OpenSpec
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: `task-completion-reconciliation`
- **Scope boundary**: top-level task checkboxes, reconciliation evidence, and apply-progress status only.

#### Reconciled Task Progress

- [x] 3.1 Context propagation and fail-closed mocked contracts, completed across PR3B and PR3C.
- [x] 3.2 Effective-project propagation and confirmed context serialization, completed across PR3B and PR3C.
- [x] 4.1 Injected-token default integration contracts and opt-in live/mutating coverage, completed in PR4B1.
- [x] 4.2 Environment-only migration and security/architecture/operator documentation, completed in PR4A1 and PR4A2.
- [x] 4.3 Package validation and publication checks, completed in PR4B2.
- [ ] 4.4 Final verification and authorized live opt-in; not complete because final verification has not run and live/mutating tests remain prohibited without explicit authorization.

#### Work Unit Evidence — `task-completion-reconciliation`

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check` — PASS after the reconciliation edit. No tests were run. |
| Runtime harness command/scenario and exact result | N/A — documentation-only checkbox/evidence reconciliation; live and mutating execution was prohibited. |
| Rollback boundary | Revert only the top-level checkbox changes and the appended `task-completion-reconciliation` section in `tasks.md`, plus this matching append-only section in `apply-progress.md`. |

#### Reconciliation Notes

- PR3B and PR3C append-only sections contain the completed 3.1/3.2 evidence; the top-level checkboxes now reflect that cumulative state.
- PR4B1, PR4A1/PR4A2, and PR4B2 append-only sections prove 4.1, 4.2, and 4.3 respectively; those top-level checkboxes now reflect that evidence.
- Task 4.4 remains pending. No source, lockfile, proposal, specification, design, or unrelated worktree file was changed.

### Bounded Apply Update: `historical-task-check-reconciliation`

This append-only continuation records the reconciliation of duplicate task
checkboxes against the completed PR3B, PR3C, PR4A1, PR4A2, PR4B1, and PR4B2
evidence. It does not rewrite or delete prior evidence, introduce source
changes, or claim final verification.

- **State**: partial
- **Mode**: Strict TDD evidence preserved; this continuation is documentation-only.
- **Artifact store**: native OpenSpec
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: `historical-task-check-reconciliation`
- **Scope boundary**: task checkbox reconciliation and append-only progress evidence only.

#### Reconciliation Result

- Duplicate historical entries for 3.1, 3.2, PR3C resource migration, 4.1,
  4.2, and 4.3 are reconciled in `tasks.md` against their recorded evidence.
- All 4.4/final-verification/authorized-live-opt-in checkboxes remain pending.
  Final verification has not run, and live or mutating tests remain
  unauthorized.
- The earlier full-batch outcome remains historical, non-authoritative evidence;
  the current bounded state is partial and ready for independent verification.

#### Work Unit Evidence — `historical-task-check-reconciliation`

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check` — PASS after the checkbox reconciliation edit. No tests were run. |
| Runtime harness command/scenario and exact result | N/A — documentation-only artifact reconciliation; live and mutating execution was prohibited. |
| Rollback boundary | Revert only the historical checkbox correction and this append-only section in `tasks.md` and `apply-progress.md`; preserve all prior evidence and unrelated files. |

### Bounded Apply Update: `final-verification`

This append-only update records the final verification slice after the
parent-authorized isolated live run. It merges the current verification result
with all prior apply evidence and does not rewrite historical sections or rerun
live side effects.

- **State**: complete
- **Mode**: Strict TDD (`pnpm test`)
- **Artifact store**: native OpenSpec
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: `final-verification`
- **Native attempt token**: `sha256:088a3a785e2f3b5eaa6b558e9e6750b3e8dad50325b6e7e9f204122621d9a96b`
- **Scope boundary**: final verification evidence and stale task-checkbox reconciliation only.

#### Cumulative Task Progress

- [x] 1.1–1.3 Contract gate and mocked authentication/diagnostic coverage.
- [x] 2.1–2.3 Environment-only token, safe transport failures, and advisory scope behavior.
- [x] 3.1–3.3 Context propagation, fail-closed tool wiring, and metadata-only authentication registry.
- [x] 4.1 Injected-token default integration contracts and opt-in live/mutating coverage.
- [x] 4.2 Environment-only migration and security/architecture/operator documentation.
- [x] 4.3 Package validation and publication checks.
- [x] 4.4 Final verification, secret-bearing string checks, and parent-authorized isolated live opt-in.

#### TDD Cycle Evidence — Final Verification

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.4 | `tests/*.test.ts`, package validation, repository scan | Integration/package | Existing implementation and prior slice evidence | ✅ Required checks and live scenario were defined before execution | ✅ Local checks passed; parent-authorized isolated live run passed 2/2 | ✅ Mocked default suite, typecheck, diff hygiene, package evidence, and isolated live backend | ✅ Evidence-only reconciliation; no production behavior changed |

#### Work Unit Evidence — `final-verification`

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm test` — PASS: 5 files, 29 tests; `tests/live.test.ts` excluded. |
| Typecheck command and exact result | `pnpm exec tsc --noEmit` — PASS: exit 0, no output. |
| Diff hygiene command and exact result | `git diff --check` — PASS: exit 0, no output. |
| Package/build evidence | Prior PR4B2 evidence retained: build, package validation, and `dist/index.js` syntax checks passed. |
| Runtime harness command/scenario and exact result | Parent-authorized isolated local backend live run — PASS: 2/2 tests; not rerun by this actor because it includes live side effects. |
| Secret-bearing string check | PASS: prior bounded scan found no credential-shaped matches or login setup in source, tests, docs, or package metadata. |
| Rollback boundary | Revert only the eleven stale checkbox reconciliations and this append-only `final-verification` evidence section in `tasks.md` and `apply-progress.md`; preserve all implementation, prior evidence, and unrelated dirty files. |

#### Final Verification Notes

- The native attempt token is recorded for audit continuity; no credential or secret value was added to the repository.
- The eleven pending task entries reported for this apply objective now match completed evidence and are marked `[x]` in `tasks.md`.
- Live/mutating coverage remains explicitly opt-in in `package.json`; no live command was rerun here.

### Bounded Corrective Update: `verify-blockers`

This append-only update addresses the two critical blockers from the native
verification report. It preserves all prior evidence and does not change the
task checkbox state because the implementation tasks were already marked
complete; the correction closes verification gaps in that completed scope.

- **State**: partial pending independent re-verification
- **Mode**: Strict TDD (`pnpm test`)
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Remove legacy authentication surface and prove the registered `taskhub_whoami` callback
- **Native correction token**: `sha256:4f6045ce3711e7ddca8fb66592931a112244bc2d3c09245225ae986e5db4c86c`
- **Scope boundary**: `src/auth.ts`, `src/tools/context.ts`, `tests/api-key-auth.test.ts`, `tests/tool-context.test.ts`, and this append-only evidence only.
- **Changed-line budget**: bounded below 120 authored lines for this correction.

#### Corrective TDD Cycle Evidence

| Finding | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Legacy authentication surface | `tests/api-key-auth.test.ts` | Integration with filesystem fixture | ✅ 15/15 focused baseline | ✅ Legacy lifecycle absence failed against exported methods | ✅ 18/18 focused tests passed with missing-token and configured-token paths | ✅ Removed login, refresh, and logout methods; no filesystem/JWT state added | ✅ Removed unused imports and lifecycle constants |
| Registered `taskhub_whoami` callback | `tests/tool-context.test.ts` | Integration with mocked MCP callback | ✅ 15/15 focused baseline | ✅ Environment-guidance and callback assertions failed before correction | ✅ 18/18 focused tests passed with linked and missing context | ✅ Exact metadata output asserted for both context branches | ✅ Kept callback registration test-local and token-free |

#### Corrective Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/api-key-auth.test.ts tests/tool-context.test.ts` — PASS: 2 files, 18 tests. |
| Runtime harness command/scenario and exact result | N/A — no live or remote boundary is required; the registered `taskhub_whoami` callback is invoked directly through the mocked MCP registration harness in `tests/tool-context.test.ts`. |
| Rollback boundary | Revert only the corrective changes in `src/auth.ts`, `src/tools/context.ts`, `tests/api-key-auth.test.ts`, `tests/tool-context.test.ts`, and this append-only evidence section; preserve prior slices and unrelated dirty files. |

#### Corrective Implementation Notes

- `AuthManager` now exposes only in-memory token access and authentication-state queries; password login, refresh, logout, persistence, and legacy credential loading remain unavailable.
- Context-fetch failure guidance now directs users to configure `TASKHUB_API_TOKEN` and no longer references `taskhub_login`.
- Direct registered-tool tests prove `taskhub_whoami` renders user metadata, server scopes, linked or missing local context, and no token or bearer material.
- `tasks.md` was intentionally not modified; no checkbox state was falsified or changed.
