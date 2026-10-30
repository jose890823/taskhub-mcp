# TaskHub MCP Server

MCP (Model Context Protocol) server for **TaskHub** — manage tasks, projects,
organizations, comments, notifications, and activity from an MCP host.

## Quick start

### 1. Install the package

Use a published package or a local checkout. The server command can be invoked
as `taskhub-mcp` after installation, or as `node /absolute/path/to/dist/index.js`.

### 2. Configure the MCP host

The preferred setup keeps credentials out of host configuration. The API URL is
optional for local development and should be HTTPS for remote servers.

#### Claude Code

For a project-scoped server, add this to the project's `.mcp.json`. For a
user/global Claude Code registration, put the same `mcpServers` entry in
`~/.claude.json` instead:

```json
{
  "mcpServers": {
    "taskhub": {
      "command": "taskhub-mcp",
      "env": {
        "TASKHUB_API_URL": "https://api.taskhub.example/api"
      }
    }
  }
}
```

For a local checkout, replace the command with `node` and use
`["/absolute/path/to/taskhub-mcp/dist/index.js"]` as `args`.

#### OpenCode

Use OpenCode's local MCP `environment` field; do not put project keys in the
configuration:

```json
{
  "mcp": {
    "taskhub": {
      "type": "local",
      "command": ["taskhub-mcp"],
      "environment": {
        "TASKHUB_API_URL": "https://api.taskhub.example/api"
      },
      "enabled": true
    }
  }
}
```

If the executable is not on PATH, use a portable launcher script that only
selects the executable and forwards arguments:

```sh
#!/bin/sh
exec /usr/bin/node /absolute/path/to/taskhub-mcp/dist/index.js "$@"
```

Point the host's local MCP command at that launcher. This repository does not
modify Claude Code, OpenCode, or any global host configuration automatically.

### 3. Register project-bound credentials

The non-MCP credential CLI reads the key from hidden stdin; never pass a key as
a model/tool argument, command-line argument, or configuration value:

```bash
taskhub-mcp credentials add --project-id <project-uuid> --label Work
taskhub-mcp credentials list
taskhub-mcp credentials update --project-id <project-uuid>
taskhub-mcp credentials remove --project-id <project-uuid>
```

The `list` command shows only project UUIDs, optional labels, and update times.
`--token` is rejected. CLI output is separate from MCP stdio; when the server
is running, stdout remains reserved for MCP protocol frames.

The default store is outside repositories:

- Linux: `$XDG_CONFIG_HOME/taskhub/credentials.json`, or `~/.config/taskhub/credentials.json`
- macOS: `~/Library/Application Support/TaskHub/credentials.json`
- Windows: `%APPDATA%/TaskHub/credentials.json`

`TASKHUB_CONFIG_DIR` or `TASKHUB_CREDENTIALS_FILE` may select an absolute
portable location. On POSIX, the store is written as `0600` and its directory
as `0700` where supported.

### 4. Link the working directory

With a known UUID, use the profile directly and avoid discovery ambiguity:

```text
Use taskhub_connect with projectId "<project-uuid>"
```

If no context exists and the UUID is not known, temporarily configure the
backward-compatible `TASKHUB_API_TOKEN`, then call `taskhub_context` or
`taskhub_projects_list`. They can list the projects visible to that key. Connect
by `systemCode` or `slug`, or register the UUID profile and connect by
`projectId`.

The server writes only project metadata to `.taskhub.json`:

```json
{
  "projectId": "project-uuid",
  "projectName": "My Project",
  "projectSlug": "my-project",
  "systemCode": "PRJ-260219-A3K7",
  "organizationId": null,
  "organizationName": null
}
```

It never writes a token to that file.

## Multi-project behavior

TaskHub still authorizes each API key for one backend project. This feature does
not weaken that binding or create a multi-project server key. It adds a local
mapping from stable project UUID to project-bound key.

For every request, the MCP server re-reads the effective project from
`.taskhub.json` (including an active sub-project) and selects only that UUID's
profile. A profile takes precedence over `TASKHUB_API_TOKEN`; when no profile
exists, the environment variable remains the compatibility fallback. The
server never tries every profile against an endpoint.

`projectId`-first connection can select a profile before a context exists.
Slug/systemCode discovery cannot identify a profile until the UUID is known, so
it uses the current context profile or `TASKHUB_API_TOKEN`. If neither is
available, the error explains the safe next step without exposing a key.

`taskhub_whoami`, project operations, and advisory scope checks use the same
effective profile. Scope caches are separated by credential context, so
switching projects cannot reuse another project's cached scopes.

## Backward compatibility and restart semantics

Existing installations may continue using:

```text
TASKHUB_API_TOKEN=<project-bound-api-key>
```

To migrate, register a profile for the linked project's UUID, validate with
`taskhub_whoami`, then remove the environment key only after the profile works.
The old variable remains a fallback for contexts without a registered profile.

Changing `.taskhub.json` or adding/updating/removing a credential profile does
not require an MCP restart: selection occurs on each request. Changing the MCP
command, `TASKHUB_API_URL`, host environment, or installed package does require
the MCP host to restart its process. Restart after the initial host setup so it
loads the new registration.

## Security contract

- Credentials are opaque project-bound API keys; there is no password, JWT, or refresh-token migration.
- Tokens are not rendered by tools, diagnostics, metadata listing, errors, README files, tests, or `.taskhub.json`.
- The CLI is explicit and non-MCP; it accepts secrets only through hidden stdin.
- Remote API URLs must use HTTPS. HTTP is reserved for localhost development.
- The backend remains authoritative for key validity, scopes, revocation, and project access.
- No normal MCP tool mutates Claude Code, OpenCode, host configuration, or credential files.

## Tools

### Auth and context

| Tool | Description |
|------|-------------|
| `taskhub_whoami` | Current user, server scopes, and linked/effective context |
| `taskhub_context` | Show the linked project or safe discovery guidance |
| `taskhub_connect` | Link by project UUID, slug, or system code; never accepts a token |

The remaining tools manage organizations, projects, tasks, comments,
notifications, statuses, and activity. See `GUIA.md` for extension and request
lifecycle details.

## Development and verification

```bash
pnpm install
pnpm test
pnpm run test:package
pnpm run build
```

Live tests are opt-in and require explicitly authorized test credentials:
`pnpm run test:live`.

## License

MIT
