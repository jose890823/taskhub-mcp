# TaskHub MCP Server

MCP (Model Context Protocol) server for **TaskHub** — full platform control via Claude Code.

Tools for managing tasks, projects, organizations, comments, notifications, invitations, and activity — all from your terminal through Claude.

## Quick Start

### 1. Add to Claude Code config

Add to your `.mcp.json` (project or global):

```json
{
  "mcpServers": {
    "taskhub": {
      "command": "node",
      "args": ["/path/to/taskhub-mcp/dist/index.js"],
      "env": {
        "TASKHUB_API_URL": "http://localhost:3001/api",
        "TASKHUB_API_TOKEN": "<project-bound-api-key>"
      }
    }
  }
}
```

Or install from GitHub:

```json
{
  "mcpServers": {
    "taskhub": {
      "command": "npx",
      "args": ["github:jose890823/taskhub-mcp"],
      "env": {
        "TASKHUB_API_URL": "https://api.taskhub.com/api",
        "TASKHUB_API_TOKEN": "<project-bound-api-key>"
      }
    }
  }
}
```

### 2. Configure the API key

Create a project-bound TaskHub API key, provide it as `TASKHUB_API_TOKEN` in the
MCP host environment, and restart the MCP process after changing it. The key is
loaded once and held in memory only; it is not persisted, refreshed, converted,
or recoverable by the server.

Use `taskhub_whoami` to validate the key and inspect server metadata. There is
no password login or JWT migration path.

### 3. Link a project

```
Use taskhub_connect with slug "my-project"
```

This creates `.taskhub.json` in your working directory. Subsequent task operations auto-target this project.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TASKHUB_API_URL` | `http://localhost:3001/api` | TaskHub backend API URL |
| `TASKHUB_API_TOKEN` | — | The only credential: an opaque project-bound API key held in memory |

Remote API URLs must use HTTPS. Plain HTTP is reserved for local development
with `localhost` or `127.0.0.1`.

## Tools

### Auth & System
| Tool | Description |
|------|-------------|
| `taskhub_whoami` | Current user metadata, server scopes, and linked/effective project context |

### Context
| Tool | Description |
|------|-------------|
| `taskhub_context` | Show project linked to current directory |
| `taskhub_connect` | Link directory to a project (by ID, slug, or systemCode) |

### Search
| Tool | Description |
|------|-------------|
| `taskhub_search` | Find any entity by systemCode |

### Organizations
| Tool | Description |
|------|-------------|
| `taskhub_orgs_list` | List your organizations |
| `taskhub_org_create` | Create organization |
| `taskhub_org_members` | List organization members |
| `taskhub_org_invite` | Invite user to organization |

### Projects
| Tool | Description |
|------|-------------|
| `taskhub_projects_list` | List projects (filter by org or personal) |
| `taskhub_project_info` | Detailed project info with members, statuses, modules |
| `taskhub_project_create` | Create project (org or personal) |
| `taskhub_project_invite` | Invite user to project |

### Tasks
| Tool | Description |
|------|-------------|
| `taskhub_tasks_list` | List tasks with filters (auto-targets linked project) |
| `taskhub_tasks_my` | My assigned/created tasks |
| `taskhub_tasks_daily` | Daily tasks by date |
| `taskhub_task_create` | Create task (auto-uses linked project) |
| `taskhub_task_update` | Update task fields |
| `taskhub_task_complete` | Mark task as completed (auto-finds completed status) |
| `taskhub_subtask_create` | Create subtask under parent |

### Comments
| Tool | Description |
|------|-------------|
| `taskhub_comments` | List comments on a task |
| `taskhub_comment_add` | Add comment to a task |

### Notifications
| Tool | Description |
|------|-------------|
| `taskhub_notifications` | List notifications + unread count |
| `taskhub_notification_read` | Mark notification(s) as read |

### Activity
| Tool | Description |
|------|-------------|
| `taskhub_daily_summary` | Daily activity summary |

## Smart Project Detection

When you run `taskhub_connect`, a `.taskhub.json` file is created in your directory:

```json
{
  "projectId": "uuid",
  "projectName": "My Project",
  "projectSlug": "my-project",
  "systemCode": "PRJ-260219-A3K7",
  "organizationId": "uuid",
  "organizationName": "My Org"
}
```

This enables:
- `taskhub_task_create` auto-assigns to the linked project
- `taskhub_tasks_list` auto-filters by the linked project
- Project-sensitive requests use one effective project ID; missing, ambiguous,
  or mismatched context fails closed rather than switching key bindings

## Authorization and failure contract

The client performs advisory scope preflight through `GET /auth/mcp-scopes` and
may cache the result for five minutes. The cache never authorizes a request or
overrides server-side key validity, scopes, revocation, or project binding.

Only these confirmed backend combinations receive classified guidance:

| HTTP | Code | Meaning and action |
|------|------|-------------------|
| 401 | `API_KEY_INVALID` | Missing, malformed, unknown, verifier-mismatched, revoked, expired, or inactive key. Configure a valid replacement. A locally absent token fails before any request. |
| 403 | `INSUFFICIENT_SCOPE` | The key lacks the required scope. Ask a TaskHub administrator to grant the required access. |
| 403 | `PROJECT_ACCESS_DENIED` | Missing context, project mismatch, or unauthorized project access. Verify the linked project or contact an administrator. |

Unknown status/code combinations use generic safe guidance. Tokens, passwords,
authorization headers, endpoint configuration, and raw backend details are not
returned in tool errors or startup diagnostics.

`taskhub_whoami` is metadata-only: it reports user metadata, server scopes, and
local/effective context, never the API key.

## Migration, rollout, and rollback

1. Create a new project-bound key; do not convert a password, JWT, or legacy key.
2. Configure `TASKHUB_API_TOKEN` outside source control and validate with
   `taskhub_whoami`.
3. Link the working directory with `taskhub_connect` and verify the effective
   project before project-sensitive operations.
4. For a revoked, expired, or inactive key, revoke it at the server, create a
   replacement, update the host environment, and restart the MCP process.

To roll back a deployment, stop the MCP process and restore the previously
published version from its versioned source or package. Reconfigure the
environment as required; never restore or copy credential files. Any live or
mutating validation for this migration must be explicitly opted in; its harness
conversion is tracked separately and is not part of this documentation slice.

Package/release validation and the remaining migration test work are tracked
separately; this README does not claim those checks have passed.

## Development

```bash
pnpm install
pnpm build       # Compile TypeScript
pnpm dev         # Watch mode
pnpm start       # Run compiled server
```

## License

MIT
