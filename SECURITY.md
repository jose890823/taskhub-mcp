# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Security Model

Authentication is an environment-only API-key contract with no credential persistence or refresh path.

### Authentication
- `TASKHUB_API_TOKEN` is the only accepted credential.
- The opaque API key is held in memory only; it is never written to disk,
  converted, or refreshed. The client does not persist passwords or JWTs.
- Interactive password login, legacy credential files, JWT conversion, and
  refresh/retry are unavailable. Changing a key requires restarting the MCP
  process because the token is loaded once.
- Expired, revoked, inactive, malformed, unknown, or verifier-mismatched keys
  require creating and configuring a replacement key.

### Authorization
- Every protected tool call performs advisory scope preflight via
  `/auth/mcp-scopes` before execution.
- Scope cache expires every 5 minutes and never bypasses server authorization.
- Project-sensitive requests that proceed carry exactly one effective project
  ID. Missing, ambiguous, or mismatched local context fails closed; the local
  context cannot override the API key's server binding.
- If scope validation fails, the tool returns an error (never executes)

### Network
- HTTPS is enforced for all non-localhost API URLs
- Only `localhost` and `127.0.0.1` are allowed over plain HTTP (development only)
- The API key is transmitted only as a bearer value in the `Authorization`
  header over the configured HTTPS endpoint.
- Confirmed `401 API_KEY_INVALID` covers missing, malformed, unknown,
  verifier-mismatched, revoked, expired, or inactive keys.
- Confirmed `403 INSUFFICIENT_SCOPE` means the key lacks a required scope;
  `403 PROJECT_ACCESS_DENIED` means missing context, project mismatch, or
  unauthorized project access.
- These responses receive safe guidance; unknown status/code combinations use
  generic guidance. Raw details, headers, endpoints, and credential-like values
  are redacted. Startup diagnostics expose a fixed label, not configuration.

### File System
- Only writes `.taskhub.json` in the current working directory (project
  context); the API key has no filesystem persistence.
- No arbitrary file access.

### Destructive Operations
- `taskhub_task_delete` requires explicit `confirm: true` parameter
- Task info is shown before deletion for verification
- Backend uses soft-delete — data is not permanently removed from database

### Migration and recovery
- Create a new project-bound key before rollout; do not convert legacy tokens.
- Configure the key outside source control, validate with `taskhub_whoami`, and
  verify the linked/effective project before project-sensitive operations.
- Revoke a compromised or obsolete key at the server, create a replacement,
  update the host environment, and restart the MCP process.
- Rollback restores the prior version from versioned source or package. It does
  not restore or copy credential files; users reconfigure the environment.
- Live or mutating checks for this migration require explicit opt-in. The
  harness conversion, package/release proof, and final verification remain
  separate from this documentation update.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

1. **Email**: josemx890823@gmail.com
2. **Subject**: `[SECURITY] taskhub-mcp: <brief description>`

Do NOT open a public issue for security vulnerabilities.

We will acknowledge receipt within 48 hours and provide a fix timeline within 5 business days.
