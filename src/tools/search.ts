import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import { getRequestContext, readContext, withProjectContext } from '../context.js';
import { textResult, errorResult } from './helpers.js';

function projectRequest(params: Record<string, string | undefined>) {
  const linked = readContext();
  const context = getRequestContext();
  if (!linked || !context.projectId) throw new Error('A linked project context is required.');
  if (linked.subProjects && new Set(linked.subProjects.map((sub) => sub.path)).size !== linked.subProjects.length) {
    throw new Error('Ambiguous linked project context.');
  }
  return withProjectContext(params, context);
}

export function registerSearchTools(
  server: McpServer,
  api: ApiClient,
  scopes: ScopeChecker,
) {
  server.tool(
    'taskhub_search',
    'Search any entity by its systemCode (e.g. TSK-260218-A3K7, ORG-260218-B2C3, PRJ-260218-D4F1). Returns the entity type and details.',
    {
      code: z.string().describe('SystemCode to search (e.g. TSK-260218-A3K7)'),
    },
    async ({ code }) => {
      try {
        await scopes.checkScope('search:read');
        const params = projectRequest({ code });
        const result = await api.get<{ type: string; entity: Record<string, unknown> }>(
          '/search',
          params,
        );

        const lines = [
          `Found: ${result.type}`,
          ``,
          JSON.stringify(result.entity, null, 2),
        ];
        return textResult(lines.join('\n'));
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
