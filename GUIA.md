# TaskHub MCP Guide

This guide explains how to use and extend the TaskHub MCP server. It is a local
stdio/JSON-RPC process that adapts typed tool calls to the TaskHub REST API.

## Quick path

1. Build the package with `pnpm run build`.
2. Configure `TASKHUB_API_URL` and the opaque `TASKHUB_API_TOKEN` in the MCP
   registration environment.
3. Run `taskhub_whoami`, then connect the working directory with
   `taskhub_connect`.
4. Use project-sensitive tools only with a verified effective project context.

The authentication contract is environment-only: the key is held in memory,
never persisted, and never refreshed or converted. Create and configure a
replacement key when the server reports that a key is expired or revoked.

## Request lifecycle

Most protected resource calls follow this sequence:

1. Zod validates the arguments.
2. The advisory five-minute scope cache checks the requested capability.
3. The tool resolves the effective project from `.taskhub.json`; only the
   status tool accepts an explicit `contextDir`.
4. `ApiClient` sends each request over the configured endpoint with one bearer
   value. A tool may make multiple backend requests and never retries them.
5. The response envelope is unwrapped and rendered as safe text.

The backend remains authoritative for key validity, scopes, revocation, and
project binding. Local scope data never authorizes a request. Project-sensitive
calls fail closed for missing, ambiguous, or mismatched context; documented
global daily-task/status paths are the exception.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `TASKHUB_API_URL` | `http://localhost:3001/api` | TaskHub API endpoint |
| `TASKHUB_API_TOKEN` | — | Opaque project-bound API key |

Remote endpoints must use HTTPS. Localhost HTTP is the documented development
exception.
The server logs a constant endpoint label to stderr; stdout remains reserved for
MCP protocol frames.

## Project context

`taskhub_connect` resolves a project and writes local metadata to
`.taskhub.json`. Project-sensitive resource tools require a linked, unambiguous
context and serialize exactly one effective project as `projectId`.
Sub-project mappings use the longest matching path, while duplicate mappings are
rejected as ambiguous. A local file cannot change the project to which the
server key is bound. Organization-wide tools and the daily activity summary
fail closed because no confirmed project-bound API-key route is available.

`taskhub_whoami` is metadata-only. It returns user metadata, server-reported
scopes, and linked/effective context without revealing the API key.

## Safe failures

The client recognizes only confirmed backend codes:

| Code | Meaning | Guidance |
|---|---|---|
| `API_KEY_INVALID` | Missing, malformed, unknown, verifier-mismatched, revoked, expired, or inactive key | Configure a replacement key |
| `INSUFFICIENT_SCOPE` | Required scope is absent | Request the required scope |
| `PROJECT_ACCESS_DENIED` | Context is missing, mismatched, or unauthorized | Check context and key binding |

Unknown combinations use generic guidance. Tokens, passwords, authorization
headers, endpoints, and raw backend details are not returned to the caller.

## Testing and release checks

The current default test surface is mocked and non-mutating:

```bash
pnpm test
```

The dedicated opt-in live/mutation harness and package publication checks remain
pending. Do not infer their success from the default suite. Never place real
credentials in source, tests, documentation, package metadata, or logs. The
declared package allowlist is `dist/**`, `LICENSE`, and `README.md`; its actual
publication contents still require the pending package-validation work.

## Rollout, replacement, and rollback

1. Create a new project-bound API key; do not convert a password, JWT, or legacy
   credential.
2. Configure `TASKHUB_API_TOKEN` outside source control and restart the MCP
   process. Validate with `taskhub_whoami`, then verify the linked/effective
   project before protected operations.
3. For a revoked, expired, or inactive key, revoke it at the server, create a
   replacement, update the host environment, and restart the process.
4. To roll back, restore the previously published version from versioned source
   or package and reconfigure the environment. Never restore or copy credential
   files.

## Extension checklist

- Register tools under `src/tools/` and preserve manual dependency injection.
- Check the required scope before network work.
- Resolve and pass effective project context for protected resources.
- Return formatted text through `textResult` and safe failures through
  `errorResult`.
- Keep diagnostics on stderr and run the package validation before publishing.
