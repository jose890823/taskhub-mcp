import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import { textResult, errorResult } from './helpers.js';

export function registerActivityTools(
  server: McpServer,
  api: ApiClient,
  scopes: ScopeChecker,
) {
  // ─── taskhub_daily_summary ──────────────────────────────────────
  server.tool(
    'taskhub_daily_summary',
    'Get a summary of your activity for a specific day (defaults to today). Shows tasks created, completed, comments added, and activity log.',
    {
      date: z.string().optional().describe('Date in YYYY-MM-DD format (default: today)'),
    },
    async ({ date }) => {
      try {
        await scopes.checkScope('activity:read');
        const params: Record<string, string | undefined> = { date };
        const summary = await api.get<Record<string, unknown>>(
          '/activity/daily-summary',
          params,
        );

        const dateStr = date || new Date().toISOString().split('T')[0];
        const lines = [`Daily Summary for ${dateStr}`, ''];

        // Format whatever the backend returns
        if (summary.tasksCreated !== undefined) {
          lines.push(`Tasks Created: ${summary.tasksCreated}`);
        }
        if (summary.tasksCompleted !== undefined) {
          lines.push(`Tasks Completed: ${summary.tasksCompleted}`);
        }
        if (summary.commentsAdded !== undefined) {
          lines.push(`Comments Added: ${summary.commentsAdded}`);
        }

        const activities = summary.activities as Array<Record<string, unknown>> | undefined;
        if (activities?.length) {
          lines.push('', 'Activity Log:');
          activities.forEach((a) => {
            lines.push(`  - [${a.createdAt}] ${a.action} on ${a.entityType}`);
          });
        }

        // If the summary is just raw data, show it
        if (lines.length <= 2) {
          lines.push(JSON.stringify(summary, null, 2));
        }

        return textResult(lines.join('\n'));
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
