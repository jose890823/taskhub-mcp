# TaskHub MCP — Architecture

How this server is built, how a tool call flows through it, and what its
runtime contract is. For installation and usage, see [README.md](./README.md).
For the security posture, see [SECURITY.md](./SECURITY.md).

---

## What this server is

An MCP server is **not** a web API and **not** a library the model imports. It
is a separate process that speaks JSON-RPC over stdin/stdout, launched as a
child process by the MCP host (Claude Code).

TaskHub MCP is the adapter between that protocol and the TaskHub NestJS backend:

```
Claude Code  ──stdio/JSON-RPC──>  taskhub-mcp  ──HTTPS/REST──>  TaskHub API
  (host)                          (this repo)                   (NestJS)
```

The server holds no database and no business logic. Its job is three things
the backend cannot do on its own:

| Responsibility | Why it belongs here |
|----------------|---------------------|
| **Ambient context** | Resolves *which project* the caller means from the current directory, so the model never has to ask. |
| **Output shaping** | Converts REST payloads into compact prose. Raw JSON is expensive and imprecise for a model to read. |
| **Scope preflight** | Checks the server-reported capability list before resource work; backend authorization remains authoritative. |

Remove those three and what remains is an HTTP proxy with no value over `curl`.

---

## Request lifecycle

Most protected resource calls follow this path. Example: `taskhub_tasks_list`.

1. **Schema validation** — Zod validates the arguments against the shape
   declared at registration. Invalid input never reaches the network.
2. **Scope check** — `ScopeChecker.checkScope('tasks:read')`. Served from a
   5-minute in-memory cache; on miss it calls `GET /auth/mcp-scopes`. This is
   advisory and does not authorize the request.
3. **Context resolution** — `readContext()` loads `.taskhub.json` and derives
   the effective `projectId` for project-sensitive work.
4. **HTTP request** — `ApiClient` issues the selected REST request with one
   `Authorization: Bearer <TASKHUB_API_TOKEN>` header. A tool may make several
   backend requests, but the client does not retry a request.
5. **Failure classification** — Confirmed API-key failures are classified into
   safe key, scope, or project guidance; unknown responses receive generic
   guidance.
6. **Envelope unwrap** — The backend's `{ success, data, pagination }` wrapper
   is stripped; pagination is attached on a `__pagination` key.
7. **Formatting** — A formatter renders the result as compact text where a
   domain formatter exists.
8. **Return** — `{ content: [{ type: 'text', text }] }`.

Context-only tools and metadata-only identity have shorter paths. Global daily
task/status routes are allowed only where the tool contract permits them;
organization-wide operations and the daily activity summary fail closed because
no confirmed project-bound API-key route is available. Errors at any step are caught per tool and returned as
`{ content: [...], isError: true }` — the server never crashes on a failed call.

---

## Module map

| Layer | File | Responsibility |
|-------|------|----------------|
| Composition root | `src/index.ts` | Wires config → auth → API → scopes → tools → transport |
| Configuration | `src/config.ts` | Environment variables and HTTPS enforcement |
| Authentication | `src/auth.ts` | In-memory environment-only API-key holder |
| HTTP transport | `src/api-client.ts` | Verbs, one bearer request, safe failures, envelope unwrap |
| Scope preflight | `src/scopes.ts` | Advisory scope cache with TTL |
| Project context | `src/context.ts` | `.taskhub.json` read/write, sub-project resolution |
| Types | `src/types.ts` | Domain interfaces shared across tools |
| Tool registry | `src/tools/index.ts` | Calls each domain's `register*Tools()` |
| Formatters | `src/tools/helpers.ts` | Domain object → text; `textResult` / `errorResult` |
| Tools | `src/tools/*.ts` | One file per domain |

Dependency injection is manual — constructors take their collaborators, wired
once in `index.ts`. There is no container and no framework.

---

## Runtime state

Three separate stores, deliberately kept apart.

| Store | Location | Scope | Committed |
|-------|----------|-------|-----------|
| Project link | `.taskhub.json` | Per working directory | Local metadata |
| API key | `TASKHUB_API_TOKEN` environment variable | Per MCP process | No |
| Endpoint | `TASKHUB_API_URL` env var | Per MCP registration | In `.mcp.json` |

### `.taskhub.json`

Links a directory to a TaskHub project, and optionally maps subdirectories to
their own projects:

```json
{
  "projectId": "…",
  "projectName": "TaskHub Development",
  "systemCode": "PRJ-260327-SO1Y",
  "organizationId": null,
  "subProjects": [
    { "path": "./backend", "projectId": "…", "projectName": "Backend API" },
    { "path": "./admin",   "projectId": "…", "projectName": "Admin Dashboard" }
  ]
}
```

`resolveActiveProject()` performs **longest-prefix matching** of the current
directory against each `subProjects[].path`. Working inside `backend/src/`
resolves to the Backend API project; working at the repository root resolves to
the parent. No match falls back to the parent project.

> **Known limitation** — `process.cwd()` is fixed when the server process
> starts and does not track the agent's working directory. Callers should pass
> `contextDir` explicitly where accuracy matters. This is documented inline in
> `src/context.ts`.

### API key

`TASKHUB_API_TOKEN` is the only credential input. `AuthManager` reads the opaque
value once at startup and keeps it in memory. It never reads or writes a
credential file, persists tokens, converts legacy values, or refreshes after a
failure. Switching endpoints therefore requires an explicit environment
configuration and a project-bound key.

---

## Authentication

The server uses an environment-only API-key contract. `TASKHUB_API_TOKEN` is
sent as one bearer value per request over HTTPS. A missing key prevents the
request before network access; an `API_KEY_INVALID` response requires creating
and configuring a replacement key. There is no password login, persistence,
conversion, refresh, or retry path.

---

## Safe failure boundary

Only confirmed backend combinations are classified:

| Response | Meaning | Client guidance |
|----------|---------|-----------------|
| `401 API_KEY_INVALID` | Missing, malformed, unknown, verifier-mismatched, revoked, expired, or inactive key | Configure a valid replacement key |
| `403 INSUFFICIENT_SCOPE` | Required scope is absent | Contact a TaskHub administrator |
| `403 PROJECT_ACCESS_DENIED` | Missing context, project mismatch, or unauthorized project | Verify context and key binding |

Other status/code combinations receive generic guidance. The client does not
return raw backend messages/details or credential-like values. Startup
diagnostics write a fixed endpoint label to stderr; stdout remains JSON-RPC.

## Project authority and tool exceptions

`.taskhub.json` is local project metadata, not proof of API-key binding. The
shared context helper rejects an explicit project that differs from the active
linked project and resource tools fail closed for missing or ambiguous context.
Organization-wide operations are rejected locally, and `taskhub_daily_summary`
is rejected because its route has no confirmed project-bound API-key form.
Global statuses and daily tasks remain available only through their explicit
global paths. Server validity, scopes, revocation, and project authorization
remain authoritative for every protected request.

---

## Authorization: scopes

The backend exposes `GET /api/auth/mcp-scopes`, returning a flat capability
list. Protected resource tools declare a required scope and check it before
doing work; context tools are local/API lookup helpers without that preflight.

The client asks the server for the available scope names. Current tool checks use
these scope families:

```
tasks:read          tasks:write
projects:read       projects:write
organizations:read  organizations:write
comments:read       comments:write
notifications:read  notifications:write
invitations:write   activity:read
search:read
```

Cached values are copied and expire after 5 minutes. `invalidateCache()` is
available for local cache reset; there is no login flow that depends on it.
Cached scopes never bypass server validation, revocation, or project binding.

---

## Tool surface

30 tools registered across 10 domain modules.

| Domain | Count | Tools |
|--------|-------|-------|
| Tasks | 9 | `tasks_list`, `tasks_my`, `tasks_daily`, `task_get`, `task_create`, `task_update`, `task_complete`, `task_delete`, `subtask_create` |
| Projects | 7 | `projects_list`, `project_info`, `project_create`, `project_invite`, `project_members`, `subproject_add`, `subproject_remove` |
| Organizations | 4 | `orgs_list`, `org_create`, `org_invite`, `org_members` |
| Auth | 1 | `whoami` |
| Context | 2 | `connect`, `context` |
| Comments | 2 | `comments`, `comment_add` |
| Notifications | 2 | `notifications`, `notification_read` |
| Activity | 1 | `daily_summary` |
| Statuses | 1 | `statuses` |
| Search | 1 | `search` |

### Flexible identifiers

`task_get`, `task_update`, `task_complete`, `task_delete`, and `subtask_create`
accept any of three forms for their identifier/task ID field:

| Form | Example |
|------|---------|
| UUID | `cd64e0b9-d4c9-4ebd-9a8f-cd79c45e26c9` |
| System code | `TSK-260327-B0F3` |
| Free-text title search | `login` |

This removes a round trip: the model does not have to list tasks first just to
obtain a UUID.

---

## Design decisions

### Text output, not JSON

Tools return formatted prose:

```
[TSK-260327-B0F3] Fix login redirect
  Type: project | Priority: high | Status: En progreso
  Project: Backend API
  Assigned: Jose Carlos
```

Most results use compact formatted text. Task descriptions are truncated at
200 characters and paginated task/project results include a one-line footer.
Search and the activity fallback may include a JSON representation when the
backend shape has no dedicated formatter.

### Tool descriptions are instructions, not documentation

A tool's `description` is the only thing the model reads before deciding
whether to call it. `taskhub_statuses` uses that budget deliberately:

> *"IMPORTANT: Call this tool BEFORE creating or updating tasks so you know
> valid statusId values."*

That sentence is prompt engineering embedded in the schema. Treat tool
descriptions as part of the interface, not as comments.

### HTTPS is enforced, fail-closed

`loadConfig()` throws at startup if `TASKHUB_API_URL` is neither HTTPS nor a
localhost address. A misconfigured endpoint stops the server rather than
sending a bearer token in clear text.

### stdout belongs to the protocol

The stdio transport uses stdout for JSON-RPC frames. **All logging goes to
`console.error`.** A single `console.log` anywhere in the process corrupts the
stream and breaks the server. This is the most common way to break an MCP.

---

## Specifications

| Item | Value |
|------|-------|
| Package | `taskhub-mcp` v1.1.0, MIT |
| Runtime | Node ≥ 18 (relies on global `fetch`) |
| Module system | ESM (`"type": "module"`, `.js` extensions in imports) |
| Transport | stdio (`StdioServerTransport`) |
| Protocol SDK | `@modelcontextprotocol/sdk` ^1.12.0 |
| Runtime dependencies | 2 — MCP SDK and `zod` ^3.24 |
| Source size | ~2 170 lines across 19 TypeScript files |
| Build | `tsc` → `dist/`, entrypoint `dist/index.js`, `bin: taskhub-mcp` |
| Tests | Vitest (`pnpm test`) |
| Default endpoint | `http://localhost:3001/api` |
| Env vars | `TASKHUB_API_URL`, `TASKHUB_API_TOKEN` |

### Registration

```json
{
  "mcpServers": {
    "taskhub": {
      "command": "node",
      "args": ["/absolute/path/to/taskhub-mcp/dist/index.js"],
      "env": {
        "TASKHUB_API_URL": "http://localhost:3001/api",
        "TASKHUB_API_TOKEN": "<provided-outside-source-control>"
      }
    }
  }
}
```

---

## Adding a tool

1. Pick or create the domain file under `src/tools/`.
2. Call `server.tool(name, description, zodShape, handler)` inside that
   module's `register*Tools()` function.
3. Start protected resource handlers with `await scopes.checkScope('<resource>:<action>')`.
4. Use `getRequestContext()` / `withProjectContext()` to resolve and serialize the
   effective project.
5. Return `textResult(...)`; wrap the body in `try/catch` returning
   `errorResult(e)`.
6. Add a formatter to `helpers.ts` if the shape is new.
7. Register the module in `src/tools/index.ts` if it is new.
8. `pnpm run build`, then restart the MCP host.

Invariants to preserve:

- [ ] No `console.log` anywhere in the process.
- [ ] Every protected resource handler checks a scope before doing work.
- [ ] Every handler catches and returns `errorResult`, never throws.
- [ ] Output is formatted text; intentional JSON fallbacks are documented.
- [ ] The tool description tells the model *when* to call it, not just what it does.

---

## Release status

Package allowlisting, compiled-output parity, and publication checks are a
separate pending verification slice. This architecture guide does not claim
that package contents, the built `dist/` tree, or final verification have
passed.

---

## Next step

Complete the pending package and final-verification work before publishing. For
an operational change, restart the MCP host after changing the environment key
or endpoint, then validate with `taskhub_whoami` and the effective context.
