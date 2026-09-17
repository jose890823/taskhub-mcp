import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../auth.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';

import { registerAuthTools } from './auth.js';
import { registerContextTools } from './context.js';
import { registerSearchTools } from './search.js';
import { registerOrganizationTools } from './organizations.js';
import { registerProjectTools } from './projects.js';
import { registerTaskTools } from './tasks.js';
import { registerCommentTools } from './comments.js';
import { registerNotificationTools } from './notifications.js';
import { registerActivityTools } from './activity.js';
import { registerStatusTools } from './statuses.js';

export function registerAllTools(
  server: McpServer,
  _auth: AuthManager,
  api: ApiClient,
  scopes: ScopeChecker,
): void {
  registerAuthTools(server, api, scopes);             // 1 tool
  registerContextTools(server, api, scopes);          // 2 tools
  registerSearchTools(server, api, scopes);           // 1 tool
  registerOrganizationTools(server, api, scopes);     // 4 tools
  registerProjectTools(server, api, scopes);          // 5 tools (+project_members)
  registerStatusTools(server, api, scopes);           // 1 tool (statuses)
  registerTaskTools(server, api, scopes);             // 9 tools (+task_get, +task_delete)
  registerCommentTools(server, api, scopes);          // 2 tools
  registerNotificationTools(server, api, scopes);     // 2 tools
  registerActivityTools(server, api, scopes);         // 1 tool
  // Total: 28 tools
}
