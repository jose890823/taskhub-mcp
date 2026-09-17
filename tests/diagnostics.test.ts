import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../src/api-client.js';
import { AuthManager } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import {
  errorResult,
  redactEndpointForDiagnostic,
  writeStartupDiagnostic,
} from '../src/tools/helpers.js';

const apiUrl = 'http://localhost:3001/api';
const token = 'thk_secret_token';
const password = 'super-secret-password';
const endpoint = 'https://user:password@example.test/api?token=endpoint-secret';

function response(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientWithResponse(body: unknown, status: number): ApiClient {
  process.env.TASKHUB_API_URL = apiUrl;
  process.env.TASKHUB_API_TOKEN = token;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body, status)));
  const config = loadConfig();
  return new ApiClient(config, new AuthManager(config));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.TASKHUB_API_TOKEN;
  process.env.TASKHUB_API_URL = apiUrl;
});

describe('safe API diagnostics', () => {
  it('renders the confirmed 401 key failure without backend details', async () => {
    const api = clientWithResponse({
      success: false,
      error: {
        code: 'API_KEY_INVALID',
        message: `Authorization: Bearer ${token}; password=${password}`,
        details: { endpoint, token },
      },
    }, 401);

    const failure = await api.get('/auth/me').catch(error => error);
    const rendered = errorResult(failure).content[0].text;

    expect(rendered).toContain('API key is invalid, expired, revoked, or inactive');
    expect(rendered).not.toContain(token);
    expect(rendered).not.toContain(password);
    expect(rendered).not.toContain('Authorization');
    expect(rendered).not.toContain(endpoint);
  });

  it.each([
    ['INSUFFICIENT_SCOPE', 'required scope'],
    ['PROJECT_ACCESS_DENIED', 'authorized for this project'],
  ])('renders confirmed 403 %s guidance without backend details', async (code, guidance) => {
    const api = clientWithResponse({
      success: false,
      error: {
        code,
        message: `internal detail ${token} ${password} ${endpoint}`,
        details: { authorization: `Bearer ${token}` },
      },
    }, 403);

    const failure = await api.get('/protected').catch(error => error);
    const rendered = errorResult(failure).content[0].text;

    expect(rendered).toContain(guidance);
    expect(rendered).not.toContain(token);
    expect(rendered).not.toContain(password);
    expect(rendered).not.toContain(endpoint);
  });

  it.each([
    [401, 'OTHER_401_CODE'],
    [403, 'OTHER_403_CODE'],
    [500, 'BACKEND_INTERNAL_DETAIL'],
  ])('uses bounded generic guidance for unconfirmed %s failures', async (status, code) => {
    const api = clientWithResponse({
      success: false,
      error: {
        code,
        message: `do not echo ${token} ${password} ${endpoint}`,
        details: { authorization: `Bearer ${token}` },
      },
    }, status);

    const failure = await api.get('/protected').catch(error => error);
    const rendered = errorResult(failure).content[0].text;

    expect(rendered).toBe('Error: TaskHub request failed. Check your configuration and try again.');
    expect(rendered).not.toContain(code);
    expect(rendered).not.toContain(token);
    expect(rendered).not.toContain(password);
    expect(rendered).not.toContain(endpoint);
  });

  it('uses a constant endpoint label for startup diagnostics', () => {
    expect(redactEndpointForDiagnostic(endpoint)).toBe('configured endpoint');
    expect(redactEndpointForDiagnostic(endpoint)).not.toContain(endpoint);
  });

  it('writes startup diagnostics through the stderr writer only', () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    writeStartupDiagnostic(endpoint);

    expect(stderr).toHaveBeenCalledWith('TaskHub MCP Server running (API: configured endpoint)');
    expect(stdout).not.toHaveBeenCalled();
  });
});
