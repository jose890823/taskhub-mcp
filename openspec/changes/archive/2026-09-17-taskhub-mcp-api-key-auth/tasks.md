# Tasks: TaskHub MCP API-Key Authentication

## Review Workload Forecast

Estimated changed lines: 650–850
Delivery strategy: ask-on-risk
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Contract gate, token boundary, RED coverage | PR 1 | `pnpm vitest run tests/api-key-auth.test.ts -t "token|legacy"` | N/A — mocked fetch; read-only contract gate | `src/config.ts`, `src/auth.ts`, `src/types.ts`, contract tests |
| 2 | Safe failures and diagnostics | PR 2 | `pnpm vitest run tests/api-key-auth.test.ts tests/diagnostics.test.ts -t "401|403|redact|diagnostic"` | N/A — mocked responses and stderr | `src/api-client.ts`, `src/tools/helpers.ts`, diagnostic tests |
| 3 | Context and tool-surface migration | PR 3 | `pnpm vitest run tests/api-key-auth.test.ts -t "context|whoami|registry"` | `TASKHUB_MCP_LIVE=1 pnpm vitest run tests/live.test.ts -t "non-mutating"` | `src/context.ts`, resource tools, auth/registry |
| 4 | Docs, package contract, release proof | PR 4 | `pnpm run build && pnpm exec tsc --noEmit && pnpm run test:package` | `pnpm pack --dry-run --json` | docs, `package.json`, package tests |

## Historical Apply Slice: `pr2-safe-failures-diagnostics`

The prior full-batch checkbox state is not authoritative for this resumed baseline. PR 1 is preserved as the completed contract gate, in-memory `TASKHUB_API_TOKEN` boundary, and mocked contract coverage. PR 2 is limited to safe failures, startup diagnostics, and advisory scope behavior. Later work units remain pending until their own apply slices.

- Completed in PR 1: 1.1, 1.2, 2.1
- Completed in PR 2: 1.3, 2.2, 2.3
- Pending after PR 2: 3.1–3.3, 4.1–4.4
- Build note at the PR2 boundary: `pnpm run build` was blocked by pre-existing out-of-scope errors in `src/tools/statuses.ts` importing missing `getRequestContext` and `withProjectContext` exports from `src/context.ts`.

## Phase 1: Contract Gate and RED Tests

- [x] 1.1 **GATE:** Confirm exact backend API-key `401`/`403` codes and project-binding/route semantics from authoritative evidence; block classification and route propagation until confirmed; invent no codes.
- [x] 1.2 **RED:** Create `tests/api-key-auth.test.ts` mocked proofs for bearer-once, missing/no-fetch, legacy-file ignorance, no login/persistence/refresh/retry, and advisory scope caching.
- [x] 1.3 **RED:** Add `tests/diagnostics.test.ts` for confirmed failures, unknown generic guidance, token/password/header/endpoint/detail redaction, and stderr-only startup diagnostics.

## Phase 2: Credential and Transport GREEN/REFACTOR

- [x] 2.1 **GREEN:** Refactor `src/config.ts`, `src/auth.ts`, and `src/types.ts` to use only in-memory `TASKHUB_API_TOKEN`; remove credential paths, JWT state, and password lifecycle while preserving HTTPS checks.
- [x] 2.2 **GREEN:** Update `src/api-client.ts`, `src/tools/helpers.ts`, and `src/index.ts` for one request, confirmed-only classification, safe rendering, and constant-label startup diagnostics; never echo details.
- [x] 2.3 **REFACTOR:** Preserve five-minute advisory caching in `src/scopes.ts`; prove cached scopes never authorize or bypass server rejection.

## Phase 3: Context and Tool Wiring

- [x] 3.1 **RED:** Extend mocked contracts for effective-project propagation and fail-closed missing/ambiguous context across `src/tools/projects.ts`, `src/tools/tasks.ts`, `src/tools/statuses.ts`, `src/tools/comments.ts`, `src/tools/notifications.ts`, `src/tools/activity.ts`, `src/tools/organizations.ts`, and `src/tools/search.ts`.
- [x] 3.2 **GREEN:** Implement confirmed context serialization in `src/context.ts` and those tools; `.taskhub.json` must not override key binding or silently change routes.
- [x] 3.3 **GREEN:** Remove `taskhub_login` and legacy registration from `src/tools/auth.ts` and `src/tools/index.ts`; keep `taskhub_whoami` metadata/scopes/effective context only.

## Phase 4: Migration, Package, and VERIFY

- [x] 4.1 **GREEN:** Convert `tests/integration.test.ts` to injected-token contracts; add opt-in mutating `tests/live.test.ts`, excluded from default `pnpm test`.
- [x] 4.2 **REFACTOR:** Update `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, and `GUIA.md` for environment-only migration, replacement keys, scopes/context, safe diagnostics, no persistence, and no refresh.
- [x] 4.3 **VERIFY:** Add `tests/package-validation.mjs` and `package.json` checks for allowlist, `dist/index.js`, `main`/`exports`/`bin`, README, and excluded source/tests/OpenSpec/repository docs.
- [x] 4.4 **VERIFY:** Run `pnpm test`, build, typecheck, package validation, and authorized live opt-in; confirm no secret-bearing strings or login setup remain.

Threat matrix: all listed rows are explicitly N/A; no threat-specific test tasks are required.

### Bounded Apply Update: `pr4b1-test-gating`

This append-only update records the PR4B1 test-gating slice on top of PR1–PR4A2.
It separates mocked default contracts from explicitly opted-in live coverage and
does not claim package validation, publication proof, live execution, or final
verification.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`)
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: `pr4b-test-gating`
- **Native parent authority**: parent-confirmed proceed; token settlement remains with the parent.
- **Scope boundary**: `tests/integration.test.ts`, `tests/live.test.ts`, minimal `package.json` test scripts, and append-only evidence only.

#### Current Task Progress — PR4B1

- [x] 4.1 Convert the integration coverage to injected-token mock contracts and isolate live/mutating coverage behind `TASKHUB_MCP_LIVE=1`.
- [x] 4.3 Add package validation and publication checks.
- [x] 4.4 Run final verification and secret-bearing string checks.

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

## Bounded Apply Update: `pr3a-context-status-auth-registry`

PR3A implements the tracked context compatibility layer required by the preserved
`src/tools/statuses.ts` baseline and removes the legacy authentication tool
registration. Resource-tool propagation and new context contract tests are
deferred to PR3B; Phase 4 remains pending.

- [x] 3.1 **RED:** Context propagation/fail-closed contract tests (PR3B; new untracked tests were explicitly excluded from PR3A).
- [x] 3.2 **GREEN:** Resource-tool migration to the shared context helper (PR3A provides the tracked context helper; resource tools remain for PR3B).
- [x] 3.3 **GREEN:** Remove `taskhub_login` and legacy authentication registration; retain metadata-only `taskhub_whoami`.
- [x] 4.1–4.4 Migration, package, and final verification (PR4).

### Bounded Apply Update: `pr3b-context-task-tools`

- [x] PR3B scoped context contracts and effective-project propagation for `src/tools/projects.ts`, `src/tools/tasks.ts`, and `src/tools/statuses.ts`.
- [x] PR3C remaining resource-tool context migration (comments, notifications, activity, organizations, and search).
- [x] PR4 migration, package, and final verification.

### Bounded Apply Update: `pr3c-context-remaining-tools`

- [x] PR3C scoped context contracts and effective-project propagation for comments, notifications, activity, and search; organization-wide operations remain fail-closed because no safe project-bound API-key form is confirmed.
- [x] PR4 migration, package, and final verification.

PR3C evidence correction: `taskhub_daily_summary` is context-checked and then
fails closed rather than sending a project query, because the confirmed backend
surface does not expose a project-bound API-key route for `/activity/daily-summary`.

### Bounded Apply Update: `pr4a-migration-documentation`

This append-only update records the PR4A documentation slice on top of PR1,
PR2, PR3A, PR3B, and PR3C. It does not complete package validation, live-test
harness work, final verification, or archive readiness.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`); documentation-only work uses structural evidence and has no behavior test surface.
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Migration and operational documentation
- **Scope boundary**: `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `GUIA.md`, and append-only OpenSpec evidence only.

#### Current Task Progress — PR4A

- [x] 4.2 Update migration, security, architecture, and operations documentation
- [x] 4.1 Convert integration/live test coverage and keep mutations opt-in
- [x] 4.3 Add package validation and publication checks
- [x] 4.4 Run final verification and secret-bearing string checks

#### TDD Cycle Evidence — PR4A

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.2 | Documentation files | Documentation/structural | Existing implementation and artifact review | N/A — no executable behavior in scope | N/A — structural checks only | Confirmed token, context, scope, diagnostics, rollout, rollback, and live-test policy against PR1–PR3C evidence | Reduced cognitive load with quick paths, tables, checklists, and explicit non-claims |

#### Work Unit Evidence — PR4A

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check` — PASS; changed documentation inspected directly; bounded secret-bearing string scan — PASS with no credential-shaped matches. |
| Runtime harness command/scenario and exact result | N/A — documentation-only scope; no runtime, live, or mutating command was authorized or required. |
| Rollback boundary | Revert only the four documentation files and the appended PR4A evidence sections in `tasks.md` and `apply-progress.md`; preserve PR1–PR3C source/tests and unrelated worktree changes. |

#### PR4A Documentation Contract

- Documents only the confirmed environment-only in-memory API-key contract.
- States that password/JWT persistence, refresh, conversion, and legacy login are unavailable.
- Describes project binding/context, advisory scopes, safe confirmed `401`/`403` guidance, replacement/revocation, HTTPS, rollout, and rollback.
- Keeps live or mutating testing explicitly opt-in and does not claim live execution or final verification.
- PR4B package/release proof remains pending.

### Bounded Apply Update: `pr4a1-readme-security`

This append-only update is the authoritative PR4A1 documentation slice on top
of PR1–PR3C. It intentionally separates README and security guidance from the
remaining PR4A2 architecture/operations documentation and PR4B proof work.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`); documentation-only work has no executable behavior test surface.
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Environment-only API-key migration and security documentation
- **Scope boundary**: `README.md`, `SECURITY.md`, and append-only evidence only.

#### Current Task Progress — PR4A1

- [x] Document the in-memory `TASKHUB_API_TOKEN` contract, confirmed failures, context, scopes, rollout, and rollback in `README.md` and `SECURITY.md`.
- [x] PR4A2 update `ARCHITECTURE.md` and `GUIA.md`.
- [x] 4.1 convert integration/live test coverage and keep mutations opt-in.
- [x] 4.3 add package validation and publication checks.
- [x] 4.4 run final verification and authorized live opt-in.

PR4A1 does not claim package/release proof, live-test execution, final
verification, or archive readiness.

### Bounded Apply Update: `pr4a2-architecture-guide`

This append-only update records the PR4A2 architecture and operator-guide slice
on top of PR1–PR4A1. It does not complete package validation, live-test
execution, final verification, or archive readiness.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`); documentation-only work has no executable behavior test surface.
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: Architecture and operator guidance
- **Scope boundary**: `ARCHITECTURE.md`, `GUIA.md`, and append-only evidence only.

#### Current Task Progress — PR4A2

- [x] Align architecture and operator guidance with the implemented in-memory token, context, scope, failure, HTTPS, and migration contracts.
- [x] 4.1 Convert integration/live test coverage and keep mutations opt-in.
- [x] 4.3 Add package validation and publication checks.
- [x] 4.4 Run final verification and authorized live opt-in.

#### TDD Cycle Evidence — PR4A2

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR4A2 | `ARCHITECTURE.md`, `GUIA.md` | Documentation/structural | PR1–PR3C implementation and PR4A1 artifact review | N/A — no executable behavior in scope | N/A — structural checks only | Confirmed token boundary, context exceptions, scope preflight, safe failures, HTTPS, and rollout/replacement/rollback guidance | Removed stale tool/package claims and used progressive-disclosure sections |

#### Work Unit Evidence — PR4A2

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check` — PASS; both changed guides inspected directly; bounded secret-bearing string scan — PASS with no credential-shaped matches. |
| Runtime harness command/scenario and exact result | N/A — documentation-only scope; no runtime, live, or mutating command was authorized or required. |
| Rollback boundary | Revert only `ARCHITECTURE.md`, `GUIA.md`, and this appended PR4A2 evidence section in `tasks.md` and `apply-progress.md`; preserve PR1–PR4A1 source, tests, docs, and unrelated worktree changes. |

#### PR4A2 Notes

- The guides describe the confirmed environment-only `TASKHUB_API_TOKEN` held in memory, with no password/JWT persistence, conversion, refresh, or login path.
- Project-sensitive tools, global exceptions, organization/activity fail-closed behavior, advisory scopes, confirmed `401`/`403` guidance, HTTPS, and stderr-safe diagnostics match the current implementation.
- Replacement/revocation and rollback guidance does not restore or copy credentials.
- PR4B package/release proof, final verification, and authorized live execution remain pending.

### Bounded Apply Update: `pr4b1-test-gating`

This append-only update records the PR4B1 test-gating slice on top of PR1–PR4A2.
It separates mocked default contracts from explicitly opted-in live coverage and
does not claim package validation, publication proof, live execution, or final
verification.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest`)
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: `pr4b-test-gating`
- **Native parent authority**: parent-confirmed proceed; token settlement remains with the parent.
- **Scope boundary**: `tests/integration.test.ts`, `tests/live.test.ts`, minimal `package.json` test scripts, and append-only evidence only.

#### Current Task Progress — PR4B1

- [x] 4.1 Convert the integration coverage to injected-token mock contracts and isolate live/mutating coverage behind `TASKHUB_MCP_LIVE=1`.
- [x] 4.3 Add package validation and publication checks.
- [x] 4.4 Run final verification and secret-bearing string checks.

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

This append-only update records the PR4B2 package-validation slice on top of
PR1–PR4B1. It validates package metadata and the actual `pnpm pack --dry-run
--json` file set without changing source, lockfile, integration/live tests, or
repository-only documentation. Final verification and archive readiness remain
pending.

- **State**: partial
- **Mode**: Strict TDD (`pnpm vitest` available; package validation is a Node script)
- **Artifact store**: hybrid
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: `pr4b2-package-validation`
- **Native parent authority**: parent-confirmed proceed; token settlement remains with the parent.
- **Scope boundary**: `package.json`, `tests/package-validation.mjs`, and append-only evidence only.

#### Current Task Progress — PR4B2

- [x] 4.3 Add package validation and publication checks for entrypoints, allowlist, required docs, and excluded development paths.
- [x] 4.4 Run final verification and secret-bearing string checks.

#### TDD Cycle Evidence — PR4B2

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.3 | `tests/package-validation.mjs` | Package/runtime | ✅ Existing dry-run: 79 files | ✅ Script assertion failed before adding `test:package` | ✅ `pnpm run test:package`: 79 published files validated | ✅ Entrypoints, license/docs, allowlist, exclusions, syntax, and actual pack output | ✅ Root derived from module URL; no secrets or private paths; pack JSON parsed directly |

#### Work Unit Evidence — PR4B2

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm run test:package` — PASS: package metadata, allowlist, exclusions, `dist/index.js`, syntax, and 79 packed files validated. |
| Runtime harness command/scenario and exact result | `node --check dist/index.js` — PASS; `pnpm pack --dry-run --json` — PASS: 79 files limited to `dist/**`, `LICENSE`, `package.json`, and `README.md`. Live/mutating tests were not run. |
| Rollback boundary | Revert only the `test:package` entry in `package.json`, `tests/package-validation.mjs`, and the appended PR4B2 sections in `tasks.md` and `apply-progress.md`; preserve `pnpm-lock.yaml` and all prior-slice/unrelated dirty paths. |
| Build and typecheck | `pnpm run build` — PASS; `pnpm exec tsc --noEmit` — PASS. |
| Diff hygiene | `git diff --check` — PASS. |

#### PR4B2 Notes

- `main`, `exports`, and `bin.taskhub-mcp` all resolve exactly to `./dist/index.js`.
- The explicit `files` allowlist remains `dist`, `LICENSE`, and `README.md`; validation accounts for npm's required published `package.json` metadata while rejecting source, tests, OpenSpec, repository-only docs, environment files, and other development paths.
- Package validation/publication proof for this slice passes; final verification, authorized live execution, and archive readiness remain pending.

### Bounded Apply Update: `task-completion-reconciliation`

This append-only update reconciles the top-level task checkboxes with the
completed PR3B, PR3C, PR4A1, PR4A2, PR4B1, and PR4B2 evidence above. It does
not introduce source changes or claim final verification.

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
- [x] 4.4 Final verification and authorized live opt-in; complete after the parent-authorized isolated live run and final local checks.

#### Work Unit Evidence — `task-completion-reconciliation`

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check` — PASS after the reconciliation edit. No tests were run. |
| Runtime harness command/scenario and exact result | N/A — documentation-only checkbox/evidence reconciliation; live and mutating execution was prohibited. |
| Rollback boundary | Revert only the top-level checkbox changes and the appended `task-completion-reconciliation` section in `tasks.md`, plus its matching append-only section in `apply-progress.md`. |

#### Reconciliation Notes

- PR3B and PR3C append-only sections already contain the completed 3.1/3.2 evidence; the top-level checkboxes now reflect that cumulative state.
- PR4B1, PR4A1/PR4A2, and PR4B2 append-only sections already prove 4.1, 4.2, and 4.3 respectively; those top-level checkboxes now reflect that evidence.
- Task 4.4 remains pending. No source, lockfile, proposal, specification, design, or unrelated worktree file was changed.

### Bounded Apply Update: `historical-task-check-reconciliation`

This append-only continuation reconciles duplicate historical checkboxes with
the already-recorded PR3B, PR3C, PR4A1, PR4A2, PR4B1, and PR4B2 evidence. It
does not introduce source changes or claim final verification.

- **State**: partial
- **Mode**: Strict TDD evidence preserved; this continuation is documentation-only.
- **Artifact store**: native OpenSpec
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: `historical-task-check-reconciliation`
- **Scope boundary**: duplicate historical checkboxes in this file and append-only reconciliation evidence only.

#### Reconciliation Result

- Historical duplicate entries for 3.1, 3.2, PR3C resource migration, 4.1,
  4.2, and 4.3 now reflect the completed evidence already recorded above.
- Every 4.4, final-verification, and authorized-live-opt-in checkbox remains
  pending because final verification has not run and live/mutating tests are
  not authorized.
- No source, package, lockfile, test, documentation, proposal, specification,
  design, or unrelated worktree file was changed.

#### Work Unit Evidence — `historical-task-check-reconciliation`

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check` — PASS after the checkbox reconciliation edit. No tests were run. |
| Runtime harness command/scenario and exact result | N/A — documentation-only checkbox reconciliation; live and mutating execution was prohibited. |
| Rollback boundary | Revert only the duplicate checkbox changes and this append-only reconciliation section in `tasks.md`; preserve all prior evidence and unrelated files. |

### Bounded Apply Update: `final-verification`

This append-only update records the final verification slice after the
parent-authorized isolated live run. It reconciles the eleven stale unchecked
task entries above with the completed implementation and verification evidence;
it does not change source behavior or rerun live side effects.

- **State**: complete
- **Mode**: Strict TDD (`pnpm test`)
- **Artifact store**: native OpenSpec
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: stacked-to-main
- **Review policy**: 400 changed lines
- **Work unit**: `final-verification`
- **Native attempt token**: `sha256:088a3a785e2f3b5eaa6b558e9e6750b3e8dad50325b6e7e9f204122621d9a96b`
- **Scope boundary**: final verification evidence and stale task-checkbox reconciliation only.

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
| Rollback boundary | Revert only the eleven stale checkbox reconciliations and this append-only `final-verification` evidence section in `tasks.md`; preserve all implementation, prior evidence, and unrelated dirty files. |

#### Final Verification Notes

- The native attempt token is recorded for audit continuity; no credential or secret value was added to the repository.
- All eleven pending task entries reported for this apply objective now match completed evidence and are marked `[x]`.
- Live/mutating coverage remains explicitly opt-in in `package.json`; no live command was rerun here.
