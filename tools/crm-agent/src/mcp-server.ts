import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { CrmError, MAX_PAGE_LIMIT } from './domain.ts';
import type { CrmReadPort } from './domain.ts';
import { createToolRegistry, listToolDefinitions } from './registry.ts';

export interface McpServerOptions {
  getPort: () => CrmReadPort;
  now?: () => Date;
}

const listInput = z.strictObject({
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  cursor: z.string().min(1).max(256).regex(/^[\x21-\x7e]+$/).optional(),
});
const getInput = z.strictObject({ id: z.uuid() });
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function createMcpServer(options: McpServerOptions): McpServer {
  const server = new McpServer({ name: 'cominorsa-crm-agent', version: '0.1.0' });
  let registry: ReturnType<typeof createToolRegistry> | undefined;
  const resolveRegistry = () => {
    registry ??= createToolRegistry(options.getPort(), options.now);
    return registry;
  };
  for (const tool of listToolDefinitions()) {
    const inputSchema = tool.name.startsWith('list_') ? listInput : getInput;
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema,
      annotations: READ_ONLY,
    }, async (input: unknown) => {
      try {
        const result = await resolveRegistry().callTool(tool.name, input);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: { ...result },
        };
      } catch (error) {
        const safe = error instanceof CrmError ? error : new CrmError('internal_error', 'CRM tool failed.');
        return {
          isError: true,
          content: [{ type: 'text' as const, text: JSON.stringify({ code: safe.code, message: safe.message }) }],
        };
      }
    });
  }
  return server;
}
