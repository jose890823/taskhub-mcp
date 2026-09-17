import { describe, expect, it } from 'vitest';
import { ApiClient } from '../src/api-client.js';
import { AuthManager } from '../src/auth.js';
import { loadConfig } from '../src/config.js';

const liveEnabled = process.env.TASKHUB_MCP_LIVE === '1';
const projectId = process.env.TASKHUB_MCP_PROJECT_ID;

describe.skipIf(!liveEnabled)('explicit live integration coverage', () => {
  it('reads authenticated metadata from the configured server', async () => {
    const config = loadConfig();
    const user = await new ApiClient(config, new AuthManager(config)).get<{
      id: string;
      email: string;
    }>('/auth/me');

    expect(user).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
    });
  });

  it.skipIf(!projectId)('creates and removes a live task only under explicit opt-in', async () => {
    const config = loadConfig();
    const api = new ApiClient(config, new AuthManager(config));
    const task = await api.post<{ id: string; title: string }>('/tasks', {
      title: `MCP live contract ${Date.now()}`,
      type: 'project',
      priority: 'low',
      projectId,
    });

    try {
      expect(task).toMatchObject({
        id: expect.any(String),
        title: expect.stringContaining('MCP live contract'),
      });
    } finally {
      await api.del(`/tasks/${task.id}?projectId=${encodeURIComponent(projectId!)}`);
    }
  });
});
