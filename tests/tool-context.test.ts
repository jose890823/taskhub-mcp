import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerProjectTools } from '../src/tools/projects.js';
import { registerStatusTools } from '../src/tools/statuses.js';
import { registerTaskTools } from '../src/tools/tasks.js';
import { registerCommentTools } from '../src/tools/comments.js';
import { registerNotificationTools } from '../src/tools/notifications.js';
import { registerActivityTools } from '../src/tools/activity.js';
import { registerOrganizationTools } from '../src/tools/organizations.js';
import { registerSearchTools } from '../src/tools/search.js';
import { registerAuthTools } from '../src/tools/auth.js';
import { buildNoContextMessage } from '../src/tools/context.js';

const contextState = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock('../src/context.js', () => ({
  readContext: vi.fn(() => contextState.current),
  getRequestContext: vi.fn(() => contextState.current
    ? { projectId: contextState.current.projectId as string, projectName: 'Project A' }
    : { projectId: null }),
  withProjectContext: vi.fn((params: Record<string, string | undefined>, request: { projectId: string | null }) => {
    if (params.projectId && params.projectId !== request.projectId) {
      throw new Error('Explicit project does not match the linked project context.');
    }
    if (!request.projectId) {
      const { projectId: _projectId, ...rest } = params;
      return rest;
    }
    return { ...params, projectId: request.projectId };
  }),
  getEffectiveProjectId: vi.fn(() => contextState.current?.projectId),
  getAllProjectIds: vi.fn(() => contextState.current?.projectId ? [contextState.current.projectId] : []),
}));

type Handler = (input: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function makeServer() {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    tool(name: string, ...args: unknown[]) {
      handlers.set(name, args.at(-1) as Handler);
    },
  };
}

function makeApi() {
  return {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({ marked: 1 }),
  };
}

const scopes = {
  checkScope: vi.fn().mockResolvedValue(undefined),
  fetchScopes: vi.fn().mockResolvedValue(['tasks:read']),
};

afterEach(() => {
  contextState.current = null;
  vi.clearAllMocks();
});

describe('project-bound tool context', () => {
  it('directs configuration failures to the environment API key', async () => {
    const api = makeApi();
    api.get.mockRejectedValueOnce(new Error('backend unavailable'));

    const message = await buildNoContextMessage(api as never);

    expect(message).toContain('Configure TASKHUB_API_TOKEN with a valid API key');
    expect(message).not.toContain('taskhub_login');
  });

  it('invokes taskhub_whoami with metadata and linked context only', async () => {
    contextState.current = { projectId: 'project-a' };
    const server = makeServer();
    const api = makeApi();
    api.get.mockResolvedValueOnce({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'user',
      isActive: true,
    });

    registerAuthTools(server as never, api as never, scopes as never);

    const result = await server.handlers.get('taskhub_whoami')!({});
    const text = result.content[0].text;

    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(scopes.fetchScopes).toHaveBeenCalledTimes(1);
    expect(text).toBe([
      'User: Ada Lovelace',
      'Email: ada@example.com',
      'Role: user',
      'Active: true',
      '',
      'Scopes (1): tasks:read',
      '',
      'Linked Project: Project A [unknown]',
      '  Type: Personal project',
    ].join('\n'));
    expect(text).not.toContain('TASKHUB_API_TOKEN');
    expect(text).not.toContain('Bearer');
  });

  it('reports missing local context without exposing credential material', async () => {
    const server = makeServer();
    const api = makeApi();
    api.get.mockResolvedValueOnce({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      role: 'admin',
      isActive: true,
    });

    registerAuthTools(server as never, api as never, scopes as never);

    const result = await server.handlers.get('taskhub_whoami')!({});
    const text = result.content[0].text;

    expect(text).toBe([
      'User: Grace Hopper',
      'Email: grace@example.com',
      'Role: admin',
      'Active: true',
      '',
      'Scopes (1): tasks:read',
      '',
      'No project linked to current directory.',
    ].join('\n'));
    expect(text).not.toContain('TASKHUB_API_TOKEN');
    expect(text).not.toContain('Bearer');
  });

  it('does not call the API when a protected task request has no context', async () => {
    const server = makeServer();
    const api = makeApi();
    registerTaskTools(server as never, api as never, scopes as never);

    const result = await server.handlers.get('taskhub_tasks_list')!({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: TaskHub request failed. Check your configuration and try again.');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('propagates one effective project and rejects a silent project override', async () => {
    contextState.current = { projectId: 'project-a' };
    const server = makeServer();
    const api = makeApi();
    registerProjectTools(server as never, api as never, scopes as never);
    registerTaskTools(server as never, api as never, scopes as never);

    await server.handlers.get('taskhub_project_members')!({});
    expect(api.get).toHaveBeenCalledWith('/projects/project-a/members', { projectId: 'project-a' });

    await server.handlers.get('taskhub_tasks_list')!({});
    expect(api.get).toHaveBeenNthCalledWith(2, '/tasks', expect.objectContaining({ projectId: 'project-a' }));

    const result = await server.handlers.get('taskhub_tasks_list')!({ projectId: 'project-b' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: TaskHub request failed. Check your configuration and try again.');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('fails closed for duplicate linked sub-project mappings', async () => {
    contextState.current = {
      projectId: 'project-a',
      subProjects: [
        { path: './backend', projectId: 'project-b' },
        { path: './backend', projectId: 'project-c' },
      ],
    };
    const server = makeServer();
    const api = makeApi();
    registerStatusTools(server as never, api as never, scopes as never);

    const result = await server.handlers.get('taskhub_statuses')!({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: TaskHub request failed. Check your configuration and try again.');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('keeps the global status path when no project was linked', async () => {
    const server = makeServer();
    const api = makeApi();
    registerStatusTools(server as never, api as never, scopes as never);

    await server.handlers.get('taskhub_statuses')!({});

    expect(api.get).toHaveBeenCalledWith('/task-statuses/global', {});
  });

  it('propagates one effective project across the remaining project-bound tools', async () => {
    contextState.current = { projectId: 'project-a' };
    const server = makeServer();
    const api = makeApi();
    registerCommentTools(server as never, api as never, scopes as never);
    registerNotificationTools(server as never, api as never, scopes as never);
    registerActivityTools(server as never, api as never, scopes as never);
    registerSearchTools(server as never, api as never, scopes as never);

    await server.handlers.get('taskhub_comments')!({ taskId: 'task-1' });
    expect(api.get).toHaveBeenCalledWith('/comments/task/task-1', { projectId: 'project-a' });

    await server.handlers.get('taskhub_notifications')!({ page: 2, limit: 10 });
    expect(api.get).toHaveBeenCalledWith('/v1/notifications', {
      page: '2',
      limit: '10',
      projectId: 'project-a',
    });

    const activityResult = await server.handlers.get('taskhub_daily_summary')!({ date: '2026-09-17' });
    expect(activityResult.isError).toBe(true);
    expect(api.get).toHaveBeenCalledTimes(2);

    await server.handlers.get('taskhub_search')!({ code: 'TSK-1' });
    expect(api.get).toHaveBeenCalledWith('/search', {
      code: 'TSK-1',
      projectId: 'project-a',
    });
  });

  it('propagates the effective project to notification writes and comment writes', async () => {
    contextState.current = { projectId: 'project-a' };
    const server = makeServer();
    const api = makeApi();
    registerCommentTools(server as never, api as never, scopes as never);
    registerNotificationTools(server as never, api as never, scopes as never);

    await server.handlers.get('taskhub_comment_add')!({ taskId: 'task-1', content: 'Update' });
    expect(api.post).toHaveBeenCalledWith('/comments?projectId=project-a', {
      taskId: 'task-1',
      content: 'Update',
    });

    await server.handlers.get('taskhub_notification_read')!({ notificationId: 'notification-1' });
    expect(api.post).toHaveBeenCalledWith(
      '/v1/notifications/notification-1/read?projectId=project-a',
    );
  });

  it('fails closed without context for protected remaining resource tools', async () => {
    const registrations = [
      registerCommentTools,
      registerNotificationTools,
      registerActivityTools,
      registerSearchTools,
    ];

    for (const register of registrations) {
      const server = makeServer();
      const api = makeApi();
      register(server as never, api as never, scopes as never);
      const toolName = register === registerCommentTools
        ? 'taskhub_comments'
        : register === registerNotificationTools
          ? 'taskhub_notifications'
          : register === registerActivityTools
            ? 'taskhub_daily_summary'
            : 'taskhub_search';
      const input = toolName === 'taskhub_comments'
        ? { taskId: 'task-1' }
        : toolName === 'taskhub_daily_summary'
          ? { date: '2026-09-17' }
          : toolName === 'taskhub_search'
            ? { code: 'TSK-1' }
            : {};

      const result = await server.handlers.get(toolName)!(input);

      expect(result.isError).toBe(true);
      expect(api.get).not.toHaveBeenCalled();
    }
  });

  it('rejects organization-wide operations and search remains project-bound', async () => {
    contextState.current = { projectId: 'project-a' };
    const server = makeServer();
    const api = makeApi();
    registerOrganizationTools(server as never, api as never, scopes as never);
    registerSearchTools(server as never, api as never, scopes as never);

    const result = await server.handlers.get('taskhub_orgs_list')!({});
    expect(result.isError).toBe(true);
    expect(api.get).not.toHaveBeenCalled();

    await server.handlers.get('taskhub_search')!({ code: 'ORG-1' });
    expect(api.get).toHaveBeenCalledWith('/search', {
      code: 'ORG-1',
      projectId: 'project-a',
    });
  });

  it('fails closed for ambiguous sub-project mappings across remaining tools', async () => {
    contextState.current = {
      projectId: 'project-a',
      subProjects: [
        { path: './backend', projectId: 'project-b' },
        { path: './backend', projectId: 'project-c' },
      ],
    };

    for (const [register, toolName, input] of [
      [registerCommentTools, 'taskhub_comments', { taskId: 'task-1' }],
      [registerNotificationTools, 'taskhub_notifications', {}],
      [registerActivityTools, 'taskhub_daily_summary', { date: '2026-09-17' }],
      [registerSearchTools, 'taskhub_search', { code: 'TSK-1' }],
    ] as const) {
      const server = makeServer();
      const api = makeApi();
      register(server as never, api as never, scopes as never);

      const result = await server.handlers.get(toolName)!(input);

      expect(result.isError).toBe(true);
      expect(api.get).not.toHaveBeenCalled();
    }
  });
});
