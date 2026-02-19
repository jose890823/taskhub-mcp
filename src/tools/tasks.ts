import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { Task, TaskStatus, ProjectDetail } from '../types.js';
import { readContext } from '../context.js';
import {
  textResult,
  errorResult,
  formatTask,
  formatTaskList,
  paginationInfo,
} from './helpers.js';

export function registerTaskTools(
  server: McpServer,
  api: ApiClient,
  scopes: ScopeChecker,
) {
  // ─── taskhub_tasks_list ─────────────────────────────────────────
  server.tool(
    'taskhub_tasks_list',
    'List tasks with filters. Without explicit projectId, uses the project linked to the current directory. Supports filtering by status, type, assignee, and pagination.',
    {
      projectId: z.string().optional().describe('Filter by project UUID (auto-detected from .taskhub.json if omitted)'),
      statusId: z.string().optional().describe('Filter by status UUID'),
      type: z.enum(['project', 'daily']).optional().describe('Filter by task type'),
      assignedToId: z.string().optional().describe('Filter by assigned user UUID'),
      organizationId: z.string().optional().describe('Filter by organization UUID'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Items per page (default: 20)'),
    },
    async ({ projectId, statusId, type, assignedToId, organizationId, page, limit }) => {
      try {
        await scopes.checkScope('tasks:read');

        // Auto-detect project from context if not specified
        const ctx = readContext();
        const effectiveProjectId = projectId || ctx?.projectId;

        const params: Record<string, string | undefined> = {
          projectId: effectiveProjectId,
          statusId,
          type,
          assignedToId,
          organizationId,
          page: page?.toString(),
          limit: limit?.toString(),
        };

        const tasks = await api.get<Task[]>('/tasks', params);
        const arr = Array.isArray(tasks) ? tasks : [];

        let header = '';
        if (!projectId && ctx) {
          header = `[Auto-filtered by linked project: ${ctx.projectName}]\n\n`;
        }

        return textResult(header + formatTaskList(arr) + paginationInfo(tasks));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_tasks_my ───────────────────────────────────────────
  server.tool(
    'taskhub_tasks_my',
    'Get tasks assigned to or created by me.',
    {
      type: z.enum(['project', 'daily']).optional().describe('Filter by task type'),
    },
    async ({ type }) => {
      try {
        await scopes.checkScope('tasks:read');
        const params: Record<string, string | undefined> = { type };
        const tasks = await api.get<Task[]>('/tasks/my', params);
        const arr = Array.isArray(tasks) ? tasks : [];
        return textResult(formatTaskList(arr) + paginationInfo(tasks));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_tasks_daily ────────────────────────────────────────
  server.tool(
    'taskhub_tasks_daily',
    'Get daily tasks for a specific date (defaults to today).',
    {
      date: z.string().optional().describe('Date in YYYY-MM-DD format (default: today)'),
    },
    async ({ date }) => {
      try {
        await scopes.checkScope('tasks:read');
        const params: Record<string, string | undefined> = { date };
        const tasks = await api.get<Task[]>('/tasks/daily', params);
        const arr = Array.isArray(tasks) ? tasks : [];
        const dateStr = date || new Date().toISOString().split('T')[0];
        return textResult(
          `Daily tasks for ${dateStr}:\n\n` +
            formatTaskList(arr) +
            paginationInfo(tasks),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_task_create ────────────────────────────────────────
  server.tool(
    'taskhub_task_create',
    'Create a new task. For project tasks, uses the linked project from .taskhub.json unless a different projectId is specified. If projectId differs from the linked project, a warning is shown.',
    {
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description'),
      type: z.enum(['project', 'daily']).default('project').describe('Task type'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').describe('Task priority'),
      projectId: z.string().optional().describe('Project UUID (auto-detected for project tasks)'),
      statusId: z.string().optional().describe('Status UUID'),
      scheduledDate: z.string().optional().describe('Scheduled date (YYYY-MM-DD)'),
      dueDate: z.string().optional().describe('Due date (YYYY-MM-DD)'),
      assigneeIds: z.array(z.string()).optional().describe('Array of user UUIDs to assign'),
    },
    async ({ title, description, type, priority, projectId, statusId, scheduledDate, dueDate, assigneeIds }) => {
      try {
        await scopes.checkScope('tasks:write');
        const ctx = readContext();

        let effectiveProjectId = projectId;
        let warning = '';

        if (type === 'project') {
          if (!projectId && ctx) {
            effectiveProjectId = ctx.projectId;
          } else if (projectId && ctx && projectId !== ctx.projectId) {
            warning = `⚠️ WARNING: You are in project "${ctx.projectName}" but creating a task in a different project (${projectId}).\n\n`;
          } else if (!projectId && !ctx) {
            return errorResult(
              'No project specified and no project linked to this directory. ' +
                'Use taskhub_connect to link a project first, or pass projectId explicitly.',
            );
          }
        }

        const body: Record<string, unknown> = {
          title,
          description,
          type,
          priority,
          projectId: effectiveProjectId,
          statusId,
          scheduledDate,
          dueDate,
          assigneeIds,
        };

        const task = await api.post<Task>('/tasks', body);
        return textResult(warning + `Task created:\n${formatTask(task)}`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_task_update ────────────────────────────────────────
  server.tool(
    'taskhub_task_update',
    'Update a task. Specify the task ID and any fields to change.',
    {
      taskId: z.string().describe('Task UUID'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('New priority'),
      statusId: z.string().optional().describe('New status UUID'),
      scheduledDate: z.string().optional().describe('New scheduled date (YYYY-MM-DD)'),
      dueDate: z.string().optional().describe('New due date (YYYY-MM-DD)'),
      assigneeIds: z.array(z.string()).optional().describe('New assignee UUIDs (replaces existing)'),
    },
    async ({ taskId, ...updates }) => {
      try {
        await scopes.checkScope('tasks:write');

        // Remove undefined values
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(updates)) {
          if (v !== undefined) body[k] = v;
        }

        const task = await api.patch<Task>(`/tasks/${taskId}`, body);
        return textResult(`Task updated:\n${formatTask(task)}`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_task_complete ──────────────────────────────────────
  server.tool(
    'taskhub_task_complete',
    'Mark a task as completed. Automatically finds the "completed" status for the task\'s project and applies it.',
    {
      taskId: z.string().describe('Task UUID to complete'),
    },
    async ({ taskId }) => {
      try {
        await scopes.checkScope('tasks:write');

        // Get the task to find its project
        const task = await api.get<Task>(`/tasks/${taskId}`);

        if (task.completedAt) {
          return textResult(`Task [${task.systemCode}] "${task.title}" is already completed.`);
        }

        // Find completed status for this project
        let completedStatusId: string | null = null;

        if (task.projectId) {
          const project = await api.get<ProjectDetail>(`/projects/${task.projectId}`);
          const completedStatus = project.statuses?.find(
            (s) => s.name.toLowerCase().includes('complet') || s.name.toLowerCase().includes('done'),
          );
          if (completedStatus) {
            completedStatusId = completedStatus.id;
          }
        }

        // If no project status found, try to find a global completed status
        if (!completedStatusId) {
          // For daily tasks or fallback, set completedAt directly
          const updated = await api.patch<Task>(`/tasks/${taskId}`, {
            ...(completedStatusId ? { statusId: completedStatusId } : {}),
            completedAt: new Date().toISOString(),
          });
          return textResult(`Task completed:\n${formatTask(updated)}`);
        }

        const updated = await api.patch<Task>(`/tasks/${taskId}`, {
          statusId: completedStatusId,
        });
        return textResult(`Task completed:\n${formatTask(updated)}`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_subtask_create ─────────────────────────────────────
  server.tool(
    'taskhub_subtask_create',
    'Create a subtask under an existing task.',
    {
      parentTaskId: z.string().describe('Parent task UUID'),
      title: z.string().describe('Subtask title'),
      description: z.string().optional().describe('Subtask description'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').describe('Subtask priority'),
      assigneeIds: z.array(z.string()).optional().describe('Assignee UUIDs'),
    },
    async ({ parentTaskId, title, description, priority, assigneeIds }) => {
      try {
        await scopes.checkScope('tasks:write');

        const body: Record<string, unknown> = {
          title,
          description,
          priority,
          assigneeIds,
        };

        const subtask = await api.post<Task>(
          `/tasks/${parentTaskId}/subtasks`,
          body,
        );
        return textResult(`Subtask created:\n${formatTask(subtask)}`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
