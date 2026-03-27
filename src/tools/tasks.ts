import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { Task, TaskStatus, ProjectDetail } from '../types.js';
import { readContext, getEffectiveProjectId, getAllProjectIds } from '../context.js';
import { buildNoContextMessage } from './context.js';
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
        const effectiveProjectId = projectId || (ctx ? getEffectiveProjectId(ctx) : undefined);

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
          // Show the active project name (may be a sub-project based on cwd)
          const activeName = ctx.subProjects?.length
            ? (getEffectiveProjectId(ctx) !== ctx.projectId
              ? ctx.subProjects.find(s => s.projectId === getEffectiveProjectId(ctx))?.projectName || ctx.projectName
              : ctx.projectName)
            : ctx.projectName;
          header = `[Auto-filtered by linked project: ${activeName}]\n\n`;
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

  // ─── taskhub_task_get ──────────────────────────────────────────
  server.tool(
    'taskhub_task_get',
    'Get full details of a single task. Accepts UUID, systemCode (TSK-XXXXXX-XXXX), or a search term to find by title. Examples: taskhub_task_get({identifier: "TSK-260218-B0F3"}) or taskhub_task_get({identifier: "login"}).',
    {
      identifier: z.string().describe('Task UUID, systemCode (TSK-...), or search term to find by title'),
    },
    async ({ identifier }) => {
      try {
        await scopes.checkScope('tasks:read');

        // If it looks like a UUID or systemCode, fetch directly
        const isDirectId = identifier.match(/^[0-9a-f-]{36}$/i) || identifier.match(/^TSK-/i);

        if (isDirectId) {
          const task = await api.get<Task>(`/tasks/${identifier}`);
          return textResult(formatTask(task));
        }

        // Otherwise, search by title in project tasks
        const ctx = readContext();
        const allIds = ctx ? getAllProjectIds(ctx) : [];
        // Backend limits projectIds to 10 — cap to avoid 400 errors
        const cappedIds = allIds.slice(0, 10);
        const effectiveId = ctx ? getEffectiveProjectId(ctx) : undefined;
        const searchParams: Record<string, string | undefined> = cappedIds.length > 1
          ? { projectIds: cappedIds.join(','), limit: '50' }
          : { projectId: effectiveId, limit: '50' };
        const params: Record<string, string | undefined> = searchParams;
        const tasks = await api.get<Task[]>('/tasks', params);
        const arr = Array.isArray(tasks) ? tasks : [];

        const term = identifier.toLowerCase();
        const matches = arr.filter(t =>
          t.title.toLowerCase().includes(term) ||
          t.systemCode?.toLowerCase().includes(term),
        );

        if (matches.length === 0) {
          return textResult(`No task found matching "${identifier}".`);
        }
        if (matches.length === 1) {
          // Fetch full detail for the single match
          const task = await api.get<Task>(`/tasks/${matches[0].id}`);
          return textResult(formatTask(task));
        }

        // Multiple matches — show list for user to pick
        return textResult(
          `Found ${matches.length} tasks matching "${identifier}":\n\n` +
            formatTaskList(matches) +
            '\n\nUse the systemCode or UUID to get a specific task.',
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_task_create ────────────────────────────────────────
  server.tool(
    'taskhub_task_create',
    'Create a new task. IMPORTANT: Before calling this tool, ALWAYS ask the user to confirm: (1) whether this is a "project" task or a "daily" routine task, and (2) confirm the linked project context. When a project is linked via .taskhub.json, ALL tasks (project and daily) are associated to it by default. Only omit projectId if the user explicitly says the task is not related to any project. If projectId differs from the linked project, a warning is shown.',
    {
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description'),
      type: z.enum(['project', 'daily']).default('project').describe('Task type'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').describe('Task priority'),
      projectId: z.string().optional().describe('Project UUID (auto-detected for project tasks)'),
      statusId: z.string().optional().describe('Status UUID'),
      scheduledDate: z.string().optional().describe('Scheduled date (YYYY-MM-DD)'),
      dueDate: z.string().optional().describe('Due date (YYYY-MM-DD)'),
      assignedToIds: z.array(z.string()).optional().describe('Array of user UUIDs to assign'),
    },
    async ({ title, description, type, priority, projectId, statusId, scheduledDate, dueDate, assignedToIds }) => {
      try {
        await scopes.checkScope('tasks:write');
        const ctx = readContext();

        let effectiveProjectId = projectId;
        let warning = '';

        // Auto-link to project context for ALL task types (project and daily)
        // Uses getEffectiveProjectId to resolve sub-project based on cwd
        if (!projectId && ctx) {
          effectiveProjectId = getEffectiveProjectId(ctx);
        } else if (projectId && ctx && projectId !== ctx.projectId) {
          warning = `⚠️ WARNING: You are in project "${ctx.projectName}" but creating a task in a different project (${projectId}).\n\n`;
        } else if (!projectId && !ctx && type === 'project') {
          const msg = await buildNoContextMessage(api);
          return textResult('Cannot create project task without a linked project.\n\n' + msg);
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
          assignedToIds,
        };

        const task = await api.post<Task>('/tasks', body);
        // Determine which project name to show (may be a sub-project)
        const linkedProjectName = ctx
          ? (ctx.subProjects?.find(s => s.projectId === effectiveProjectId)?.projectName ?? ctx.projectName)
          : null;
        const ctxNote = effectiveProjectId && linkedProjectName
          ? `📌 Linked to project: ${linkedProjectName}\n`
          : '';

        // Fetch available statuses so AI knows what options exist
        let statusInfo = '';
        if (effectiveProjectId) {
          try {
            const statuses = await api.get<TaskStatus[]>(`/projects/${effectiveProjectId}/statuses`);
            const arr = Array.isArray(statuses) ? statuses : [];
            if (arr.length) {
              const names = arr.map(s =>
                s.name + (s.isDefault ? ' (default)' : '') + (s.isCompleted ? ' (completed)' : ''),
              ).join(', ');
              statusInfo = `\nAvailable statuses: ${names}`;
            }
          } catch { /* ignore status fetch failure */ }
        }

        return textResult(warning + ctxNote + `Task created:\n${formatTask(task)}${statusInfo}`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_task_update ────────────────────────────────────────
  server.tool(
    'taskhub_task_update',
    'Update a task. Specify the task ID and any fields to change. TIP: To change status, first call taskhub_statuses to get valid statusId values for the project.',
    {
      taskId: z.string().describe('Task UUID or systemCode (TSK-XXXXXX-XXXX)'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('New priority'),
      statusId: z.string().optional().describe('New status UUID'),
      scheduledDate: z.string().optional().describe('New scheduled date (YYYY-MM-DD)'),
      dueDate: z.string().optional().describe('New due date (YYYY-MM-DD)'),
      assignedToIds: z.array(z.string()).optional().describe('New assignee UUIDs (replaces existing)'),
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
    'Mark a task as completed. Automatically finds the "completed" status for the task\'s project (using the isCompleted flag) and applies it.',
    {
      taskId: z.string().describe('Task UUID or systemCode (TSK-XXXXXX-XXXX) to complete'),
    },
    async ({ taskId }) => {
      try {
        await scopes.checkScope('tasks:write');

        // Get the task to find its project
        const task = await api.get<Task>(`/tasks/${taskId}`);

        if (task.completedAt) {
          return textResult(`Task [${task.systemCode}] "${task.title}" is already completed.`);
        }

        // Find the completed status using the isCompleted flag
        let completedStatusId: string | null = null;

        if (task.projectId) {
          const statuses = await api.get<TaskStatus[]>(`/projects/${task.projectId}/statuses`);
          const completedStatus = (Array.isArray(statuses) ? statuses : []).find((s) => s.isCompleted);
          if (completedStatus) {
            completedStatusId = completedStatus.id;
          }
        }

        // Fallback to global statuses (for daily tasks or missing project statuses)
        if (!completedStatusId) {
          try {
            const globalStatuses = await api.get<TaskStatus[]>('/task-statuses/global');
            const completed = (Array.isArray(globalStatuses) ? globalStatuses : []).find(s => s.isCompleted);
            if (completed) completedStatusId = completed.id;
          } catch { /* global statuses not available */ }
        }

        if (!completedStatusId) {
          return errorResult(
            `Could not find a completed status for this task. ` +
              (task.projectId
                ? `The project has no status with isCompleted=true. Add one via the admin dashboard.`
                : `No global completed status found. Use taskhub_task_update to set a statusId manually.`),
          );
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
      parentTaskId: z.string().describe('Parent task UUID or systemCode (TSK-XXXXXX-XXXX)'),
      title: z.string().describe('Subtask title'),
      description: z.string().optional().describe('Subtask description'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').describe('Subtask priority'),
      assignedToIds: z.array(z.string()).optional().describe('Assignee UUIDs'),
    },
    async ({ parentTaskId, title, description, priority, assignedToIds }) => {
      try {
        await scopes.checkScope('tasks:write');

        const body: Record<string, unknown> = {
          title,
          description,
          priority,
          assignedToIds,
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

  // ─── taskhub_task_delete ──────────────────────────────────────
  server.tool(
    'taskhub_task_delete',
    'Delete a task. IMPORTANT: Always confirm with the user before calling this tool. Set confirm=true to execute the deletion. Without confirm=true, it only shows what WOULD be deleted.',
    {
      taskId: z.string().describe('Task UUID or systemCode (TSK-XXXXXX-XXXX) to delete'),
      confirm: z.boolean().default(false).describe('Set to true to actually delete. Without this, only previews the task.'),
    },
    async ({ taskId, confirm }) => {
      try {
        await scopes.checkScope('tasks:write');

        const task = await api.get<Task>(`/tasks/${taskId}`);

        if (!confirm) {
          return textResult(
            `⚠️ PREVIEW — This task will be permanently deleted:\n` +
              `${formatTask(task)}\n\n` +
              `To confirm deletion, call taskhub_task_delete with confirm=true.`,
          );
        }

        await api.del(`/tasks/${taskId}`);

        return textResult(
          `Task deleted: [${task.systemCode}] "${task.title}" (${task.type}, priority: ${task.priority})`,
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
