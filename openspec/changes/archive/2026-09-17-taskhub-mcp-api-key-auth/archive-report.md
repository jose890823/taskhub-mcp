# Archive Report: TaskHub MCP API-Key Authentication

## Archive Decision

- **Change**: `taskhub-mcp-api-key-auth`
- **Closed**: 2026-09-17
- **Native status at close**: `dependencies.archive: ready`; `nextRecommended: archive`
- **Native task progress**: 49/49 complete; 0 pending
- **Verification verdict**: PASS WITH WARNINGS
- **Requirements**: 8/8 compliant
- **Scenarios**: 10/10 compliant
- **Archive intent**: Complete archive; no partial-archive override was used.

The native dispatcher resolved the active repository artifact store as OpenSpec and the repository-local archive paths below are authoritative for this close.

## Artifacts Read

The following artifacts were read directly from their native-resolved paths before archival:

- `openspec/changes/taskhub-mcp-api-key-auth/proposal.md`
- `openspec/changes/taskhub-mcp-api-key-auth/exploration.md`
- `openspec/changes/taskhub-mcp-api-key-auth/specs/mcp-api-key-auth/spec.md`
- `openspec/changes/taskhub-mcp-api-key-auth/design.md`
- `openspec/changes/taskhub-mcp-api-key-auth/tasks.md`
- `openspec/changes/taskhub-mcp-api-key-auth/apply-progress.md`
- `openspec/changes/taskhub-mcp-api-key-auth/verify-report.md`
- `openspec/config.yaml`

No Engram observation IDs apply because native status resolved this repository's active artifact store as OpenSpec.

## Final-State Evidence

- `pnpm test`: 5 files / 32 tests passed.
- Focused correction tests: 2 files / 18 tests passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run build`: passed.
- `pnpm run test:package`: passed; 79 published files validated.
- `node --check dist/index.js`: passed.
- `pnpm pack --dry-run --json`: passed.
- `git diff --check`: passed.
- Parent-authorized isolated live suite: 2/2 passed; supplemental backend API-key tests: 31/31 passed with build; Admin unit tests: 40/40 passed with build.
- Real Admin JWT login reached Dashboard and `/api-keys` loaded without console errors after the separate Admin-only pagination normalization fix.

The backend `/auth/me` compatibility correction and the Admin pagination normalization fix were made in their separate repositories. They are final-state context only; neither repository was modified or included in this archive.

## Specs Synced

| Domain | Action | Details |
|---|---|---|
| `mcp-api-key-auth` | Created | The delta was a full spec because `openspec/specs/mcp-api-key-auth/spec.md` did not exist. |

### Mechanical spec-copy readback

Command used:

```text
cp openspec/changes/taskhub-mcp-api-key-auth/specs/mcp-api-key-auth/spec.md <temporary path>
diff -r openspec/changes/taskhub-mcp-api-key-auth/specs/mcp-api-key-auth/spec.md <temporary path>
mv <temporary path> openspec/specs/mcp-api-key-auth/spec.md
```

Verbatim `diff -r` output: empty (exit status 0).

## Archive Move

The complete change directory was moved mechanically with `mv` because the change artifacts were not tracked by Git at the time of archival:

```text
mv openspec/changes/taskhub-mcp-api-key-auth openspec/changes/archive/2026-09-17-taskhub-mcp-api-key-auth
```

The active change directory is absent. The archive contains `proposal.md`, `exploration.md`, `specs/`, `design.md`, `tasks.md`, `apply-progress.md`, and `verify-report.md`.

### Mechanical archive-move readback

The pre-move recursive snapshot was compared with the archived directory using:

```text
diff -r <pre-move snapshot>/source openspec/changes/archive/2026-09-17-taskhub-mcp-api-key-auth
```

Verbatim `diff -r` output: empty (exit status 0).

## Warnings Preserved

1. No coverage or lint command is configured in `openspec/config.yaml`.
2. Supplemental live/backend/Admin evidence was reused rather than rerun after the correction; live mutation coverage was intentionally not repeated.
3. No commits or pushes were performed.
4. Unrelated dirty files were preserved.

Historical pending states remain append-only historical evidence in `tasks.md` and `apply-progress.md`; the native current task state and final verification both report all 49 tasks complete with no current pending tasks.

## Source of Truth

The canonical specification is now:

- `openspec/specs/mcp-api-key-auth/spec.md`

The completed audit trail is archived at:

- `openspec/changes/archive/2026-09-17-taskhub-mcp-api-key-auth/`

## SDD Cycle Complete

The change was planned, implemented, independently verified, and archived. No source code, credentials, backend, Admin, remotes, or unrelated files were modified by this archive operation.
