import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import { textResult, errorResult } from './helpers.js';

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
        await scopes.checkScope('search');
        const result = await api.get<{ type: string; entity: Record<string, unknown> }>(
          '/search',
          { code },
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
