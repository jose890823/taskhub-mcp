import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../auth.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { User } from '../types.js';
import { readContext } from '../context.js';
import { textResult, errorResult } from './helpers.js';

export function registerAuthTools(
  server: McpServer,
  auth: AuthManager,
  api: ApiClient,
  scopes: ScopeChecker,
) {
  // ─── taskhub_login ──────────────────────────────────────────────
  server.tool(
    'taskhub_login',
    'Login to TaskHub. Saves JWT credentials for future requests. Required before using other tools (unless TASKHUB_API_TOKEN is set).',
    { email: z.string().email(), password: z.string().min(1) },
    async ({ email, password }) => {
      try {
        const data = await auth.login(email, password);
        scopes.invalidateCache();
        return textResult(
          `Login successful!\n` +
            `User: ${data.user.firstName} ${data.user.lastName} (${data.user.email})\n` +
            `Role: ${data.user.role}\n` +
            `Credentials saved to ~/.taskhub/credentials.json`,
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_whoami ─────────────────────────────────────────────
  server.tool(
    'taskhub_whoami',
    'Show current user info, available scopes, and linked project context.',
    {},
    async () => {
      try {
        const user = await api.get<User>('/auth/me');
        const scopeList = await scopes.fetchScopes();
        const ctx = readContext();

        const lines: string[] = [
          `User: ${user.firstName} ${user.lastName}`,
          `Email: ${user.email}`,
          `Role: ${user.role}`,
          `Active: ${user.isActive}`,
          ``,
          `Scopes (${scopeList.length}): ${scopeList.join(', ')}`,
        ];

        if (ctx) {
          lines.push(
            ``,
            `Linked Project: ${ctx.projectName} [${ctx.systemCode}]`,
            `  Slug: ${ctx.projectSlug}`,
            ctx.organizationName
              ? `  Organization: ${ctx.organizationName}`
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
