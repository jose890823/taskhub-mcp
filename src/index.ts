#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { AuthManager } from './auth.js';
import { ApiClient } from './api-client.js';
import { ScopeChecker } from './scopes.js';
import { registerAllTools } from './tools/index.js';
import { writeStartupDiagnostic } from './tools/helpers.js';

async function main() {
  const config = loadConfig();
  const auth = new AuthManager(config);
  const api = new ApiClient(config, auth);
  const scopeChecker = new ScopeChecker(api);

  const server = new McpServer({
    name: 'taskhub-mcp',
    version: '1.1.1',
  });

  registerAllTools(server, auth, api, scopeChecker);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  writeStartupDiagnostic(config.apiUrl);
}

main().catch(() => {
  console.error('TaskHub MCP Server failed to start. Check your configuration and try again.');
  process.exit(1);
});
