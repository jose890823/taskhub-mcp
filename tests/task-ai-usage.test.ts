import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerTaskTools } from '../src/tools/tasks.js';
import { formatTask } from '../src/tools/helpers.js';

const contextState = vi.hoisted(() => ({ projectId: 'project-a' }));

vi.mock('../src/context.js', () => ({
  readContext: vi.fn(() => ({ projectId: contextState.projectId })),
  getRequestContext: vi.fn(() => ({ projectId: contextState.projectId })),
  withProjectContext: vi.fn((params: Record<string, string | undefined>) => ({
    ...params,
    projectId: contextState.projectId,
  })),
}));

type Handler = (input: Record<string, unknown>) => Promise<{
  content: { text: string }[];
  isError?: boolean;
}>;

function makeServer() {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    tool(name: string, ...args: unknown[]) {
      handlers.set(name, args.at(-1) as Handler);
    },
  };
}

afterEach(() => vi.clearAllMocks());

describe('task AI usage tool and formatter', () => {
  it('sends only reported usage fields and enforces tasks:write', async () => {
    const server = makeServer();
    const api = {
      post: vi.fn().mockResolvedValue({
        idempotent: false,
        execution: {},
        summary: {
          status: 'recorded',
          executionCount: 1,
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          confirmedInputTokens: 10,
          confirmedOutputTokens: 5,
          confirmedTotalTokens: 15,
          reasonCodes: [],
          reasons: [],
        },
      }),
    };
    const scopes = { checkScope: vi.fn().mockResolvedValue(undefined) };

    registerTaskTools(server as never, api as never, scopes as never);
    const result = await server.handlers.get('taskhub_task_ai_usage_record')!({
      taskId: 'TSK-260218-A1B2',
      status: 'recorded',
      provider: 'openai',
      totalTokens: 15,
    });

    expect(scopes.checkScope).toHaveBeenCalledWith('tasks:write');
    expect(api.post).toHaveBeenCalledWith(
      '/tasks/TSK-260218-A1B2/ai-usage?projectId=project-a',
      { status: 'recorded', provider: 'openai', totalTokens: 15 },
    );
    expect(result.content[0].text).toContain('AI usage recorded');
    expect(result.content[0].text).toContain('Total tokens: 15');
  });

  it('formats status, confirmed totals, and reasons without execution secrets', () => {
    const text = formatTask({
      id: 'task-1',
      title: 'Implement feature',
      description: null,
      type: 'project',
      priority: 'medium',
      systemCode: 'TSK-260218-A1B2',
      statusId: null,
      projectId: 'project-1',
      parentId: null,
      scheduledDate: null,
      dueDate: null,
      completedAt: null,
      position: 0,
      createdAt: '',
      updatedAt: '',
      aiUsage: {
        status: 'partial',
        executionCount: 2,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        confirmedInputTokens: 20,
        confirmedOutputTokens: 10,
        confirmedTotalTokens: 30,
        reasonCodes: ['usage_unavailable'],
        reasons: ['The provider did not expose token usage.'],
      },
    });

    expect(text).toContain('AI usage: partial');
    expect(text).toContain('Confirmed recorded tokens: 30');
    expect(text).toContain('The provider did not expose token usage.');
    expect(text).not.toContain('prompt');
    expect(text).not.toContain('secret');
  });
});
