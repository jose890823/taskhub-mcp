# MCP API-Key Authentication Specification

## Purpose

Define the breaking cutover to an environment-only opaque API key with server-authoritative authorization and safe project context.

## Requirements

### Requirement: Environment-only opaque credential

`TASKHUB_API_TOKEN` SHALL be the only credential input. The client SHALL keep it in memory and send it as a bearer value over HTTPS.

#### Scenario: Configured token sends one bearer
- GIVEN `TASKHUB_API_TOKEN` is configured
- WHEN a protected tool makes a request
- THEN the request uses that exact value once in its Authorization header

#### Scenario: Missing token fails closed
- GIVEN `TASKHUB_API_TOKEN` is absent or empty
- WHEN a protected tool is called
- THEN no network request is made and configuration guidance is returned

### Requirement: Breaking authentication migration

The client SHALL NOT expose password login, read or write `~/.taskhub/credentials.json`, persist JWTs, convert legacy tokens, or retry through refresh. Migration SHALL require users to create, configure, validate, and replace revoked keys.

#### Scenario: Legacy paths are unavailable
- GIVEN a legacy credential file or JWT exists
- WHEN the server starts or receives a `401`
- THEN it ignores the file and performs no login, persistence, refresh, or retry

### Requirement: Confirmed backend failure contract

The client SHALL classify `401` and `403` only according to confirmed backend API-key codes and project-route semantics. It MUST NOT invent codes or infer route behavior; backend contract confirmation is required.

#### Scenario: Unconfirmed semantics block assumption
- GIVEN a backend response does not match a confirmed API-key contract
- WHEN the response is rendered
- THEN it uses generic safe guidance without claiming a code or project interpretation

### Requirement: Secret-safe failures

Errors SHALL distinguish key-related `401` guidance from scope/project `403` guidance and redact tokens, passwords, Authorization headers, endpoint configuration, and unsafe backend details.

#### Scenario: Classified and redacted failure
- GIVEN a confirmed `401` represents a missing, invalid, expired, or revoked key, or `403` represents scope/project denial
- WHEN the response contains credential-like or internal details
- THEN safe corresponding guidance is returned, no refresh occurs, and no secret/detail is echoed

### Requirement: Metadata-only identity

`taskhub_whoami` SHALL return only user metadata, server-reported scopes, and linked/effective local project context. It SHALL never reveal, recover, or infer the API token.

#### Scenario: Identity query
- GIVEN a valid API key and local context
- WHEN `taskhub_whoami` runs
- THEN it returns metadata and context without credential material

### Requirement: Advisory scopes and server authority

Local scope caching MAY reduce preflight calls, but SHALL remain advisory. Server key validity, scopes, revocation, and project binding SHALL remain authoritative for every protected request.

#### Scenario: Revocation after cache
- GIVEN cached scopes remain locally available after server revocation
- WHEN a protected request is made
- THEN the client does not bypass server rejection

### Requirement: Fail-closed project propagation

Project-sensitive tools SHALL propagate an effective project or use a confirmed backend resolver. Local `.taskhub.json` context SHALL NOT override server key binding. Missing, ambiguous, or unverified context SHALL prevent the request.

#### Scenario: Cross-project request
- GIVEN local context selects project A and the key is bound to project B
- WHEN a project-sensitive operation targets A
- THEN the client fails closed or surfaces the server’s safe authorization result; it MUST NOT silently switch binding

### Requirement: Contract-first validation and documentation

Mocked request-contract tests SHALL be default and cover authentication failures, scope/project denial, redaction, no refresh, and context propagation. Live mutating tests SHALL require explicit opt-in. README, SECURITY, ARCHITECTURE, GUIA, package validation, and published-package checks SHALL document the breaking migration and environment-only contract.

#### Scenario: Default test execution
- GIVEN no live-test opt-in is configured
- WHEN the test command runs
- THEN mocked contracts run and mutating live tests do not

#### Scenario: Published package validation
- GIVEN the package is built for publication
- WHEN package validation runs
- THEN the build, files, and documentation agree with the environment-only contract
