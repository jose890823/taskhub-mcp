import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { Comment } from '../types.js';
import { textResult, errorResult, formatComment } from './helpers.js';

export function registerCommentTools(
  server: McpServer,
  api: ApiClient,
  scopes: ScopeChecker,
) {
  // ─── taskhub_comments ───────────────────────────────────────────
  server.tool(
    'taskhub_comments',
    'List comments on a task.',
    {
      taskId: z.string().describe('Task UUID'),
    },
    async ({ taskId }) => {
      try {
        await scopes.checkScope('comments:read');
        const comments = await api.get<Comment[]>(`/comments/task/${taskId}`);
        const arr = Array.isArray(comments) ? comments : [];
        if (!arr.length) return textResult('No comments on this task.');
        return textResult(arr.map(formatComment).join('\n\n'));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_comment_add ────────────────────────────────────────
  server.tool(
    'taskhub_comment_add',
    'Add a comment to a task.',
    {
      taskId: z.string().describe('Task UUID'),
      content: z.string().describe('Comment text'),
    },
    async ({ taskId, content }) => {
      try {
        await scopes.checkScope('comments:write');
        const comment = await api.post<Comment>('/comments', {
          taskId,
          content,
        });
        return textResult(`Comment added:\n${formatComment(comment)}`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
