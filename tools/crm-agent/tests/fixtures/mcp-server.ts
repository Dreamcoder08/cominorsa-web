import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from '../../src/mcp-server.ts';
import type { CrmReadPort } from '../../src/domain.ts';

const ID = '11111111-1111-4111-8111-111111111111';
const port: CrmReadPort = {
  listPeople: async () => ({ records: [{ id: ID, name: 'Fixture Person' }], nextCursor: null }),
  getPerson: async () => ({ id: ID, name: 'Fixture Person' }),
  listCompanies: async () => ({ records: [], nextCursor: null }),
  getCompany: async () => ({ id: ID, name: null }),
};
await createMcpServer({ getPort: () => port, now: () => new Date('2026-01-02T03:04:05.000Z') }).connect(new StdioServerTransport());
