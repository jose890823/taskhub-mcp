import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthManager } from '../src/auth.js';
import { ApiClient, AuthRequiredError } from '../src/api-client.js';
import { getCredentialStorePath, loadConfig } from '../src/config.js';
import { CredentialStore, CredentialStoreError } from '../src/credential-store.js';
import { getRequestContext } from '../src/context.js';
import { ScopeChecker } from '../src/scopes.js';

const projectA = '11111111-1111-4111-8111-111111111111';
const projectB = '22222222-2222-4222-8222-222222222222';
const tokenA = 'test-only-token-project-a';
const tokenB = 'test-only-token-project-b';

let directory: string | undefined;

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
}

function writeContext(contextDir: string, projectId: string): void {
  writeFileSync(join(contextDir, '.taskhub.json'), JSON.stringify({
    projectId,
    projectName: `Project ${projectId.slice(0, 1)}`,
    projectSlug: `project-${projectId.slice(0, 1)}`,
    systemCode: `PRJ-${projectId.slice(0, 4)}`,
    organizationId: null,
    organizationName: null,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

describe('credential profiles', () => {
  it('stores UUID-keyed profiles with restrictive permissions and metadata-only listing', () => {
    directory = mkdtempSync(join(tmpdir(), 'taskhub-credentials-'));
    const path = join(directory, 'config', 'credentials.json');
    const store = new CredentialStore(path);

    store.setToken(projectA, tokenA, 'Project A');

    expect(store.getToken(projectA)).toBe(tokenA);
    expect(store.listMetadata()).toEqual([
      expect.objectContaining({ projectId: projectA, label: 'Project A' }),
    ]);
    expect(JSON.parse(readFileSync(path, 'utf8')).profiles[projectA].token).toBe(tokenA);
    expect(JSON.stringify(store.listMetadata())).not.toContain(tokenA);

    if (process.platform !== 'win32') {
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(statSync(join(directory, 'config')).mode & 0o777).toBe(0o700);
    }
  });

  it('rejects display codes and malformed stores without exposing file contents', () => {
    directory = mkdtempSync(join(tmpdir(), 'taskhub-credentials-'));
    const path = join(directory, 'credentials.json');
    const store = new CredentialStore(path);

    expect(() => store.setToken('PRJ-260919-ABCD', tokenA)).toThrow('project UUID');
    writeFileSync(path, '{"version": 1, "profiles": {"bad": {"token": "hidden"}}}');
    const failure = (() => {
      try {
        store.listMetadata();
        return null;
      } catch (error) {
        return error;
      }
    })();
    expect(failure).toBeInstanceOf(CredentialStoreError);
    expect((failure as Error).message).toMatch(/repair or remove/i);
    expect((failure as Error).message).not.toContain('hidden');
  });

  it('uses a user configuration directory and rejects relative overrides', () => {
    expect(getCredentialStorePath({ HOME: '/home/test-user' }, 'linux')).toBe(
      '/home/test-user/.config/taskhub/credentials.json',
    );
    expect(() => getCredentialStorePath({ TASKHUB_CREDENTIALS_FILE: 'credentials.json' }, 'linux'))
      .toThrow('absolute path');
  });
});

describe('dynamic project credential selection', () => {
  it('selects the profile for the effective context on every request', async () => {
    directory = mkdtempSync(join(tmpdir(), 'taskhub-context-'));
    const contextDir = join(directory, 'project');
    const credentialsPath = join(directory, 'credentials.json');
    const store = new CredentialStore(credentialsPath);
    store.setToken(projectA, tokenA);
    store.setToken(projectB, tokenB);
    writeFileSync(join(directory, 'marker'), 'test');
    // Keep the context directory separate so switching the file is explicit.
    mkdirSync(contextDir);
    writeContext(contextDir, projectA);

    vi.stubEnv('TASKHUB_API_URL', 'http://localhost:3001/api');
    const config = loadConfig({ ...process.env, TASKHUB_CREDENTIALS_FILE: credentialsPath });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ id: 'user-a' }))
      .mockResolvedValueOnce(response({ id: 'user-b' }))
      .mockResolvedValueOnce(response({ scopes: ['projects:read'] }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new ApiClient(config, new AuthManager(config, store), () => getRequestContext(contextDir));

    await expect(api.get('/auth/me')).resolves.toEqual({ id: 'user-a' });
    writeContext(contextDir, projectB);
    await expect(api.get('/auth/me')).resolves.toEqual({ id: 'user-b' });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: `Bearer ${tokenA}` } });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ headers: { Authorization: `Bearer ${tokenB}` } });

    const scopes = new ScopeChecker(api);
    await scopes.fetchScopes();
    writeContext(contextDir, projectA);
    fetchMock.mockResolvedValueOnce(response({ scopes: ['tasks:read'] }));
    await scopes.fetchScopes();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('supports projectId-first connection and preserves the legacy environment fallback', async () => {
    directory = mkdtempSync(join(tmpdir(), 'taskhub-context-'));
    const credentialsPath = join(directory, 'credentials.json');
    const store = new CredentialStore(credentialsPath);
    store.setToken(projectB, tokenB);
    vi.stubEnv('TASKHUB_API_URL', 'http://localhost:3001/api');
    const config = loadConfig({ ...process.env, TASKHUB_CREDENTIALS_FILE: credentialsPath });
    const fetchMock = vi.fn().mockResolvedValue(response({ id: 'project-b' }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new ApiClient(config, new AuthManager(config, store), () => ({ projectId: null }));

    await api.getForProject(projectB, `/projects/${projectB}`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: `Bearer ${tokenB}` } });

    vi.stubEnv('TASKHUB_API_TOKEN', 'test-only-environment-token');
    const legacyConfig = loadConfig({ ...process.env, TASKHUB_CREDENTIALS_FILE: join(directory, 'empty.json') });
    const legacyApi = new ApiClient(legacyConfig, new AuthManager(legacyConfig), () => ({ projectId: projectA }));
    await legacyApi.get('/auth/me');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ headers: { Authorization: 'Bearer test-only-environment-token' } });
  });

  it('fails safely when a linked project has neither a profile nor the legacy token', async () => {
    directory = mkdtempSync(join(tmpdir(), 'taskhub-context-'));
    const config = loadConfig({
      ...process.env,
      TASKHUB_API_TOKEN: '',
      TASKHUB_CREDENTIALS_FILE: join(directory, 'credentials.json'),
      TASKHUB_API_URL: 'http://localhost:3001/api',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const api = new ApiClient(config, new AuthManager(config), () => ({ projectId: projectA }));

    const failure = await api.get('/auth/me').catch(error => error);
    expect(failure).toBeInstanceOf(AuthRequiredError);
    expect(failure.message).toContain('credentials add');
    expect(failure.message).not.toContain(tokenA);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
