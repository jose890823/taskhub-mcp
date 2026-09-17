import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { TaskStatus } from '../types.js';
import { getRequestContext, readContext, withProjectContext } from '../context.js';
import { buildNoContextMessage } from './context.js';
import { textResult, errorResult, formatStatusList } from './helpers.js';

function statusContext(
  projectId: string | undefined,
  contextDir: string | undefined,
) {
  const linked = readContext(contextDir);
  const context = getRequestContext(contextDir);
  if (linked?.subProjects && new Set(linked.subProjects.map((sub) => sub.path)).size !== linked.subProjects.length) {
    throw new Error('Ambiguous linked project context.');
  }
  if (!context.projectId && projectId) {
    throw new Error('A linked project context is required.');
  }
  return { linked, context, params: withProjectContext({ projectId }, context) };
}

export function registerStatusTools(
  server: McpServer,
  api: ApiClient,
  scopes: ScopeChecker,
) {
  // ─── taskhub_statuses ─────────────────────────────────────────────
  server.tool(
    'taskhub_statuses',
    'List available task statuses for a project or global statuses for daily tasks. IMPORTANT: Call this tool BEFORE creating or updating tasks so you know valid statusId values. Returns each status with its id, name, and flags (DEFAULT = auto-assigned to new tasks, COMPLETED = marks task as done).',
    {
      projectId: z.string().optional().describe('Project UUID (auto-detected from .taskhub.json if omitted). Omit for global/daily task statuses.'),
      contextDir: z.string().optional().describe('Directory containing the linked .taskhub.json'),
    },
    async ({ projectId, contextDir }) => {
      try {
        // Use tasks:read scope (statuses:read may not be available on all plans)
        await scopes.checkScope('tasks:read');

        const { linked: ctx, context, params } = statusContext(projectId, contextDir);
        const pid = context.projectId;

        let statuses: TaskStatus[];
        let header = '';

        if (pid) {
          statuses = await api.get<TaskStatus[]>(`/projects/${pid}/statuses`, params);
          if (!projectId && ctx) {
            header = `[Project: ${ctx.projectName}]\n\n`;
          }
        } else {
          statuses = await api.get<TaskStatus[]>('/task-statuses/global', params);
          header = '[Global statuses (for daily tasks)]\n\n';
        }

        const arr = Array.isArray(statuses) ? statuses : [];
        return textResult(header + formatStatusList(arr));
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
