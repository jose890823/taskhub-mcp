import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, AuthRequiredError } from '../src/api-client.js';
import type { ApiError } from '../src/api-client.js';
import { AuthManager } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import { ScopeChecker } from '../src/scopes.js';

const apiUrl = 'http://localhost:3001/api';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('API-key authentication contract', () => {
  beforeEach(() => {
    process.env.TASKHUB_API_URL = apiUrl;
    delete process.env.TASKHUB_API_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TASKHUB_API_TOKEN;
    process.env.TASKHUB_API_URL = apiUrl;
  });

  it('sends the configured token once as a bearer and does not retry a rejected token', async () => {
    process.env.TASKHUB_API_TOKEN = 'thk_test_token';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ success: true, data: { id: 'user-1' } }))
      .mockResolvedValueOnce(response({
        success: false,
        error: { code: 'API_KEY_INVALID', message: 'do not expose this detail' },
      }, 401));
    vi.stubGlobal('fetch', fetchMock);

    const config = loadConfig();
    const api = new ApiClient(config, new AuthManager(config));

    await expect(api.get('/auth/me')).resolves.toEqual({ id: 'user-1' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer thk_test_token' },
    });

    await expect(api.get('/protected')).rejects.toBeInstanceOf(AuthRequiredError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails closed without a token and makes no network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const config = loadConfig();
    const api = new ApiClient(config, new AuthManager(config));

    await expect(api.get('/auth/me')).rejects.toBeInstanceOf(AuthRequiredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps HTTPS safety while exposing no credential-file configuration', () => {
    process.env.TASKHUB_API_TOKEN = 'thk_test_token';
    process.env.TASKHUB_API_URL = 'http://api.example.com/api';
    expect(() => loadConfig()).toThrow('TASKHUB_API_URL must use HTTPS');

    process.env.TASKHUB_API_URL = 'https://api.example.com/api';
    const config = loadConfig();
    expect(config).toMatchObject({
      apiUrl: 'https://api.example.com/api',
      apiToken: 'thk_test_token',
    });
    expect(config).not.toHaveProperty('credentialsPath');
  });

  it('ignores legacy credentials and exposes no legacy authentication lifecycle', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'taskhub-mcp-auth-'));
    const credentialDir = join(homeDir, '.taskhub');
    const credentialPath = join(credentialDir, 'credentials.json');
    const legacyCredentials = JSON.stringify({
      accessToken: 'legacy-access',
      refreshToken: 'legacy-refresh',
      apiUrl,
      savedAt: new Date(0).toISOString(),
    }, null, 2);
    mkdirSync(credentialDir);
    writeFileSync(credentialPath, legacyCredentials);
    const previousHome = process.env.HOME;
    process.env.HOME = homeDir;

    try {
      const auth = new AuthManager(loadConfig());

      expect(auth.getAccessToken()).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth).not.toHaveProperty('login');
      expect(auth).not.toHaveProperty('refresh');
      expect(auth).not.toHaveProperty('logout');
      expect(readFileSync(credentialPath, 'utf8')).toBe(legacyCredentials);
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('keeps scope checks advisory while the server remains authoritative', async () => {
    process.env.TASKHUB_API_TOKEN = 'thk_test_token';
    const scopeApi = {
      get: vi.fn().mockResolvedValue({ scopes: ['tasks:read'] }),
    };
    const scopes = new ScopeChecker(scopeApi as unknown as ApiClient);

    await scopes.checkScope('tasks:read');
    await scopes.checkScope('tasks:read');
    expect(scopeApi.get).toHaveBeenCalledTimes(1);

    const fetchMock = vi.fn().mockResolvedValue(response({
      success: false,
      error: { code: 'INSUFFICIENT_SCOPE', message: 'server detail' },
    }, 403));
    vi.stubGlobal('fetch', fetchMock);
    const config = loadConfig();
    const api = new ApiClient(config, new AuthManager(config));

    await expect(api.get('/tasks')).rejects.toMatchObject({
      status: 403,
      code: 'INSUFFICIENT_SCOPE',
    } satisfies Partial<ApiError>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not let cached scopes bypass a confirmed project rejection', async () => {
    process.env.TASKHUB_API_TOKEN = 'thk_test_token';
    const scopeApi = {
      get: vi.fn().mockResolvedValue({ scopes: ['projects:read'] }),
    };
    const scopes = new ScopeChecker(scopeApi as unknown as ApiClient);
    await scopes.checkScope('projects:read');

    const fetchMock = vi.fn().mockResolvedValue(response({
      success: false,
      error: { code: 'PROJECT_ACCESS_DENIED', message: 'server project detail' },
    }, 403));
    vi.stubGlobal('fetch', fetchMock);
    const config = loadConfig();
    const api = new ApiClient(config, new AuthManager(config));

    await expect(api.get('/projects/project-a')).rejects.toMatchObject({
      status: 403,
      code: 'PROJECT_ACCESS_DENIED',
    } satisfies Partial<ApiError>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(scopeApi.get).toHaveBeenCalledTimes(1);
  });
});
