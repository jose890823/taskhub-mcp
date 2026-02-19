# TaskHub MCP Server

MCP (Model Context Protocol) server for **TaskHub** — full platform control via Claude Code.

25 tools for managing tasks, projects, organizations, comments, notifications, invitations, and activity — all from your terminal through Claude.

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
        "TASKHUB_API_URL": "http://localhost:3001/api"
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
        "TASKHUB_API_TOKEN": "optional-jwt-token"
      }
    }
  }
}
```

### 2. Authenticate

```
Use taskhub_login with email and password
```

Or set `TASKHUB_API_TOKEN` in env to skip interactive login.

### 3. Link a project

```
Use taskhub_connect with slug "my-project"
```

This creates `.taskhub.json` in your working directory. Subsequent task operations auto-target this project.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TASKHUB_API_URL` | `http://localhost:3001/api` | TaskHub backend API URL |
| `TASKHUB_API_TOKEN` | — | JWT token (skips interactive login) |

## Tools (25)

### Auth & System
| Tool | Description |
|------|-------------|
| `taskhub_login` | Login with email/password, saves JWT to ~/.taskhub/ |
| `taskhub_whoami` | Current user, scopes, and linked project |

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
- Warning if you create a task for a different project than the one linked

## Scopes & Future Monetization

The server checks user scopes via `GET /auth/mcp-scopes` before executing tools. Currently all authenticated users have all scopes. In the future, scopes can be filtered by subscription plan (free/pro/enterprise).

## Development

```bash
pnpm install
pnpm build       # Compile TypeScript
pnpm dev         # Watch mode
pnpm start       # Run compiled server
```

## License

MIT
