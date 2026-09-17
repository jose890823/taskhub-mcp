import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthManager } from '../src/auth.js';
import { ApiClient, AuthRequiredError } from '../src/api-client.js';
import { loadConfig } from '../src/config.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function injectMockToken(): string {
  const token = `mock-${randomUUID()}`;
  vi.stubEnv('TASKHUB_API_TOKEN', token);
  return token;
}

describe('default integration test policy', () => {
  it('keeps live coverage outside the default command', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts.test).toContain('--exclude tests/live.test.ts');
    expect(packageJson.scripts['test:live']).toBe(
      'TASKHUB_MCP_LIVE=1 vitest run tests/live.test.ts',
    );
  });

  it('uses an injected token for a mocked read contract', async () => {
    const token = injectMockToken();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { id: 'user-a' },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const config = loadConfig();

    await expect(new ApiClient(config, new AuthManager(config)).get('/auth/me'))
      .resolves.toEqual({ id: 'user-a' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  it('keeps mocked write contracts local and does not require live opt-in', async () => {
    injectMockToken();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { id: 'task-a' },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const api = new ApiClient(loadConfig(), new AuthManager(loadConfig()));

    await expect(api.post('/tasks', { title: 'contract fixture' }))
      .resolves.toEqual({ id: 'task-a' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('fails closed in the default suite when no token is injected', async () => {
    vi.stubEnv('TASKHUB_API_TOKEN', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const api = new ApiClient(loadConfig(), new AuthManager(loadConfig()));

    await expect(api.get('/auth/me')).rejects.toBeInstanceOf(AuthRequiredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
