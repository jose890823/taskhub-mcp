#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { AuthManager } from './auth.js';
import { ApiClient } from './api-client.js';
import { ScopeChecker } from './scopes.js';
import { registerAllTools } from './tools/index.js';

async function main() {
  const config = loadConfig();
  const auth = new AuthManager(config);
  const api = new ApiClient(config, auth);
  const scopeChecker = new ScopeChecker(api);

  const server = new McpServer({
    name: 'taskhub-mcp',
    version: '1.0.0',
  });

  registerAllTools(server, auth, api, scopeChecker);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`TaskHub MCP Server running (API: ${config.apiUrl})`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
