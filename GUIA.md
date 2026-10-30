# TaskHub MCP Guide

This guide explains the portable installation, credential-profile workflow, and
request lifecycle of the TaskHub MCP server. It is a local stdio/JSON-RPC
process that adapts typed tool calls to the TaskHub REST API.

## Portable host setup

Install the package wherever the MCP host can execute it. Claude Code uses a
`command` plus optional `args` and `env` in `.mcp.json`. OpenCode uses a local
MCP entry with a command array and its `environment` object. Both setups should
normally contain only `TASKHUB_API_URL`; the credential store is read locally by
the MCP process.

For a checkout outside this repository, a launcher is portable across hosts:

```sh
#!/bin/sh
exec /usr/bin/node /absolute/path/to/taskhub-mcp/dist/index.js "$@"
```

The launcher must not echo or construct API keys. This package never edits host
configuration from an MCP tool call. After changing the host command, launcher,
environment, or installed package, restart the MCP host so it starts the new
process.

## Credential store

The credential store maps project UUIDs to opaque, project-bound API keys. The
UUID is the key; display codes and slugs are not accepted as credential keys.
The default path is a user configuration directory, never the current working
directory or a repository. `TASKHUB_CONFIG_DIR` and
`TASKHUB_CREDENTIALS_FILE` are optional absolute-path overrides.

Use the explicit non-MCP CLI:

```bash
taskhub-mcp credentials add --project-id <project-uuid> --label Work
taskhub-mcp credentials update --project-id <project-uuid>
taskhub-mcp credentials list
taskhub-mcp credentials remove --project-id <project-uuid>
```

`add` and `update` prompt for the key through hidden stdin. Piping a secret to
stdin is supported for automation, but command-line `--token` is rejected.
List, remove, and success messages contain metadata only. On POSIX, writes use
a `0600` file and `0700` parent directory where possible. The server reloads
the store for request selection, so profile changes do not require an MCP
restart.

## Context and multi-project selection

`taskhub_connect` writes project metadata to `.taskhub.json`; it never stores a
credential. On each API request:

1. The server reads the current `.taskhub.json`.
2. It resolves the effective root or longest-matching sub-project.
3. It selects that project's profile from the user credential store.
4. If no profile exists, it falls back to `TASKHUB_API_TOKEN` for compatibility.
5. If neither exists, it fails before making a network request.

The backend still sees one bearer key and remains authoritative for its
one-project binding. A context switch therefore changes the selected local key,
not the backend authorization model. The server never probes all profiles or
sends them to arbitrary endpoints.

### Safe discovery before context

Without a context, there is no UUID with which to select a profile. Use one of
these bounded flows:

- Set `TASKHUB_API_TOKEN` for the discovery key and call `taskhub_context` or `taskhub_projects_list`.
- If the UUID is already known, register its profile and call
  `taskhub_connect({ projectId: "..." })`.
- For slug/systemCode discovery, use the current context profile or the
  environment fallback; do not expect the server to try every local profile.

After the UUID is known, prefer `projectId` when switching between projects.
`taskhub_connect` never accepts a raw token parameter.

## Request lifecycle

Most protected resource calls follow this sequence:

1. Zod validates the tool arguments.
2. The advisory scope cache selects a cache entry for the effective credential context.
3. The tool resolves the effective project and serializes one `projectId` where required.
4. `ApiClient` selects the profile or compatibility environment key for that request.
5. The API request is sent once over the configured HTTPS endpoint.
6. The response envelope is unwrapped and rendered as safe text.

`taskhub_whoami`, project listing, and scope checks use the same dynamic
selection. Scope caches are separated by profile context, so a project switch
cannot reuse another project's scope response. Local scope data never
authorizes a request.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `TASKHUB_API_URL` | `http://localhost:3001/api` | TaskHub API endpoint |
| `TASKHUB_API_TOKEN` | — | Backward-compatible one-project API key |
| `TASKHUB_CONFIG_DIR` | platform user config directory | Directory containing `credentials.json` |
| `TASKHUB_CREDENTIALS_FILE` | platform user config directory | Absolute credential-store file override |

Remote endpoints must use HTTPS. Localhost HTTP is the documented development
exception. Startup diagnostics write only a constant endpoint label to stderr;
stdout remains reserved for MCP protocol frames.

## Safe failures

Missing-profile errors say how to register a UUID profile or use the legacy
environment variable. They do not include credential values. Confirmed backend
codes are rendered as bounded guidance:

| Code | Meaning | Guidance |
|---|---|---|
| `API_KEY_INVALID` | Missing, malformed, unknown, revoked, expired, or inactive key | Configure a replacement profile or environment key |
| `INSUFFICIENT_SCOPE` | Required scope is absent | Request the required scope |
| `PROJECT_ACCESS_DENIED` | Context or project authorization is invalid | Verify the context and project-bound profile |

Unknown combinations use generic guidance. Raw backend messages, authorization
headers, endpoints, passwords, and tokens are never returned.

## Migration and rollback

1. Keep the existing `TASKHUB_API_TOKEN` outside source control while migrating.
2. Register a profile using the linked project's UUID and validate with `taskhub_whoami`.
3. Register additional project profiles, then switch each directory with `taskhub_connect`.
4. Remove the environment key only after every required context has a working profile.
5. For a revoked key, revoke it server-side, register a replacement, and retry; no MCP restart is needed for the profile update.

To roll back, restore the previous package and use the environment fallback. Do
not copy credential files into repositories or restore them from source control.

## Testing and extension

```bash
pnpm test
pnpm run test:package
pnpm run build
```

Live or mutating tests are opt-in and must use explicitly authorized test
credentials. Never place credentials in source, tests, documentation, package
metadata, logs, or `.taskhub.json`.

When adding tools, keep dependency injection, check the required scope before
network work, resolve the effective project, use `textResult`/`errorResult`,
and keep diagnostics on stderr.
