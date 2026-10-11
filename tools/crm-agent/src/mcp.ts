#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createConfiguredReadPort } from './config.ts';
import { createMcpServer } from './mcp-server.ts';

try {
  const server = createMcpServer({ getPort: () => createConfiguredReadPort(process.env) });
  await server.connect(new StdioServerTransport());
} catch {
  process.stderr.write('CRM MCP server failed to start.\n');
  process.exitCode = 1;
}
