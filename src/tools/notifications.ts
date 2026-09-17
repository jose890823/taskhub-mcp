import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { Notification } from '../types.js';
import { getRequestContext, readContext, withProjectContext } from '../context.js';
import { textResult, errorResult, formatNotification } from './helpers.js';

function projectRequest(params: Record<string, string | undefined>) {
  const linked = readContext();
  const context = getRequestContext();
  if (!linked || !context.projectId) throw new Error('A linked project context is required.');
  if (linked.subProjects && new Set(linked.subProjects.map((sub) => sub.path)).size !== linked.subProjects.length) {
    throw new Error('Ambiguous linked project context.');
  }
  return withProjectContext(params, context);
}

function scopedPath(path: string, params: Record<string, string | undefined>): string {
  return `${path}?projectId=${encodeURIComponent(params.projectId!)}`;
}

export function registerNotificationTools(
  server: McpServer,
  api: ApiClient,
  scopes: ScopeChecker,
) {
  // ─── taskhub_notifications ──────────────────────────────────────
  server.tool(
    'taskhub_notifications',
    'List your notifications with unread count.',
    {
      page: z.number().optional().describe('Page number'),
      limit: z.number().optional().describe('Items per page'),
    },
    async ({ page, limit }) => {
      try {
        await scopes.checkScope('notifications:read');
        const params: Record<string, string | undefined> = {
          page: page?.toString(),
          limit: limit?.toString(),
        };
        const scopedParams = projectRequest(params);
        const result = await api.get<{
          data: Notification[];
          unreadCount: number;
          pagination: { total: number; page: number; limit: number; totalPages: number };
        }>('/v1/notifications', scopedParams);

        // The API wraps notifications in { data, unreadCount, pagination }
        // but our ApiClient unwraps the outer envelope, so result IS the inner data
        const notifications = Array.isArray(result) ? result : (result.data || []);
        const unread = Array.isArray(result) ? 0 : (result.unreadCount || 0);

        const lines = [`Unread: ${unread}\n`];
        if (Array.isArray(notifications) && notifications.length) {
          lines.push(notifications.map(formatNotification).join('\n\n'));
        } else {
          lines.push('No notifications.');
        }

        return textResult(lines.join('\n'));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_notification_read ──────────────────────────────────
  server.tool(
    'taskhub_notification_read',
    'Mark a notification as read, or mark all notifications as read.',
    {
      notificationId: z.string().optional().describe('Notification UUID (omit to mark ALL as read)'),
    },
    async ({ notificationId }) => {
      try {
        await scopes.checkScope('notifications:write');
        const params = projectRequest({});

        if (notificationId) {
          await api.post<Notification>(scopedPath(`/v1/notifications/${notificationId}/read`, params));
          return textResult(`Notification ${notificationId} marked as read.`);
        } else {
          const result = await api.post<{ marked: number }>(scopedPath('/v1/notifications/read-all', params));
          return textResult(`All notifications marked as read (${result.marked} updated).`);
        }
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
