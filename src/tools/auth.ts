import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { User } from '../types.js';
import { getRequestContext } from '../context.js';
import { textResult, errorResult } from './helpers.js';

export function registerAuthTools(
  server: McpServer,
  api: ApiClient,
  scopes: ScopeChecker,
) {
  // ─── taskhub_whoami ─────────────────────────────────────────────
  server.tool(
    'taskhub_whoami',
    'Show current user info, available scopes, and linked project context.',
    {},
    async () => {
      try {
        const user = await api.get<User>('/auth/me');
        const scopeList = await scopes.fetchScopes();
        const context = getRequestContext();

        const lines: string[] = [
          `User: ${user.firstName} ${user.lastName}`,
          `Email: ${user.email}`,
          `Role: ${user.role}`,
          `Active: ${user.isActive}`,
          ``,
          `Scopes (${scopeList.length}): ${scopeList.join(', ')}`,
        ];

        if (context.projectId) {
          lines.push(
            ``,
            `Linked Project: ${context.projectName || context.projectId} [${context.systemCode || 'unknown'}]`,
            ...(context.projectSlug ? [`  Slug: ${context.projectSlug}`] : []),
            context.organizationName
              ? `  Organization: ${context.organizationName}`
              : `  Type: Personal project`,
          );
        } else {
          lines.push(``, `No project linked to current directory.`);
        }

        return textResult(lines.join('\n'));
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
