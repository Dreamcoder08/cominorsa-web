import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createMcpServer } from '../src/mcp-server.ts';
import { CrmError, createTwentyReadPort, listToolDefinitions, type CrmReadPort } from '../src/index.ts';

const ID = '11111111-1111-4111-8111-111111111111';
const fakePort: CrmReadPort = {
  listPeople: async () => ({ records: [{ id: ID, name: 'Ada' }], nextCursor: null }),
  getPerson: async () => ({ id: ID, name: 'Ada' }),
  listCompanies: async () => ({ records: [], nextCursor: null }),
  getCompany: async () => ({ id: ID, name: null }),
};

async function connect(port: CrmReadPort = fakePort) {
  const server = createMcpServer({ getPort: () => port, now: () => new Date('2026-01-02T03:04:05.000Z') });
  const client = new Client({ name: 'fixture-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { server, client };
}

test('MCP handshake publishes exactly the four read-only CRM tools', async () => {
  const { server, client } = await connect();
  try {
    const listing = await client.listTools();
    assert.deepEqual(listing.tools.map((tool) => tool.name), [
      'list_people', 'get_person', 'list_companies', 'get_company',
    ]);
    assert.ok(listing.tools.every((tool) => tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint === false));
  } finally {
    await client.close();
    await server.close();
  }
});

test('MCP call returns shared registry provenance as text and structured content', async () => {
  const { server, client } = await connect();
  try {
    const response = await client.callTool({ name: 'get_person', arguments: { id: ID } });
    assert.equal(response.isError, undefined);
    const expected = { source: 'twenty', retrievedAt: '2026-01-02T03:04:05.000Z', record: { id: ID, name: 'Ada' } };
    assert.deepEqual(response.structuredContent, expected);
    assert.deepEqual(JSON.parse((response.content[0] as { text: string }).text), expected);
  } finally {
    await client.close(); await server.close();
  }
});

test('MCP list schema is strict and matches shared registry page bounds', async () => {
  const { server, client } = await connect();
  try {
    const listing = await client.listTools();
    const list = listing.tools.find((tool) => tool.name === 'list_people');
    assert.ok(list);
    assert.equal(list.inputSchema.additionalProperties, false);
    const properties = list.inputSchema.properties as Record<string, { minimum?: number; maximum?: number; maxLength?: number }>;
    assert.equal(properties.limit?.minimum, 1);
    assert.equal(properties.limit?.maximum, 25);
    assert.equal(properties.cursor?.maxLength, 256);
    const get = listing.tools.find((tool) => tool.name === 'get_person');
    assert.deepEqual(get?.inputSchema.required, ['id']);
  } finally {
    await client.close(); await server.close();
  }
});


test('stdio fixture completes a real handshake and tool call without stderr output', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['tests/fixtures/mcp-server.ts'],
    cwd: root,
    env: { PATH: process.env.PATH ?? '' },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  const client = new Client({ name: 'stdio-fixture-client', version: '1.0.0' });
  try {
    await client.connect(transport);
    const listing = await client.listTools();
    assert.equal(listing.tools.length, 4);
    const result = await client.callTool({ name: 'list_people', arguments: { limit: 1 } });
    assert.deepEqual(result.structuredContent, {
      source: 'twenty', retrievedAt: '2026-01-02T03:04:05.000Z',
      records: [{ id: ID, name: 'Fixture Person' }], nextCursor: null,
    });
    assert.equal(stderr, '');
  } finally {
    await client.close();
  }
});

test('production stdio entry lists tools without credentials and denies a real call', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['src/mcp.ts'],
    cwd: root,
    env: { PATH: process.env.PATH ?? '' },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  const client = new Client({ name: 'stdio-production-client', version: '1.0.0' });
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 4);
    const result = await client.callTool({ name: 'list_people', arguments: {} });
    assert.equal(result.isError, true);
    assert.deepEqual(JSON.parse((result.content[0] as { text: string }).text), {
      code: 'network_denied', message: 'CRM network access is disabled.',
    });
    assert.equal(stderr, '');
  } finally {
    await client.close();
  }
});


test('listing is credential-free and does not resolve the CRM port', async () => {
  let resolved = false;
  const server = createMcpServer({ getPort: () => { resolved = true; throw new Error('secret-key'); } });
  const client = new Client({ name: 'listing-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => [tool.name, tool.description]), listToolDefinitions().map((tool) => [tool.name, tool.description]));
    assert.equal(resolved, false);
  } finally {
    await client.close(); await server.close();
  }
});

test('invalid MCP input is denied before any CRM port call', async () => {
  let calls = 0;
  const guard: CrmReadPort = {
    listPeople: async () => { calls++; return { records: [], nextCursor: null }; },
    getPerson: async () => { calls++; return { id: ID, name: null }; },
    listCompanies: async () => { calls++; return { records: [], nextCursor: null }; },
    getCompany: async () => { calls++; return { id: ID, name: null }; },
  };
  const { server, client } = await connect(guard);
  try {
    for (const request of [
      { name: 'list_people', arguments: { limit: 26 } },
      { name: 'list_people', arguments: { endpoint: '/rest/secret' } },
      { name: 'get_person', arguments: { id: 'not-a-uuid' } },
    ]) {
      const outcome = await client.callTool(request).then(
        (result) => ({ result, error: null }),
        (error: unknown) => ({ result: null, error }),
      );
      if (outcome.result) {
        assert.equal(outcome.result.isError, true);
        assert.doesNotMatch(JSON.stringify(outcome.result), /\/rest\/secret/);
      } else {
        assert.ok(outcome.error);
        assert.doesNotMatch(String(outcome.error), /\/rest\/secret/);
      }
    }
    assert.equal(calls, 0);
  } finally {
    await client.close(); await server.close();
  }
});

test('MCP errors are categorized without leaking transport details or secrets', async () => {
  const port: CrmReadPort = {
    ...fakePort,
    getPerson: async () => { throw new Error('secret-api-key https://crm.example.test/private'); },
    getCompany: async () => { throw new CrmError('unavailable', 'CRM request is unavailable.'); },
  };
  const { server, client } = await connect(port);
  try {
    const internal = await client.callTool({ name: 'get_person', arguments: { id: ID } });
    assert.equal(internal.isError, true);
    assert.deepEqual(JSON.parse((internal.content[0] as {text: string}).text), { code: 'internal_error', message: 'CRM tool failed.' });
    const known = await client.callTool({ name: 'get_company', arguments: { id: ID } });
    assert.equal(known.isError, true);
    assert.deepEqual(JSON.parse((known.content[0] as {text: string}).text), { code: 'unavailable', message: 'CRM request is unavailable.' });
    assert.doesNotMatch(JSON.stringify([internal, known]), /secret-api-key|crm\.example\.test/);
  } finally {
    await client.close(); await server.close();
  }
});

test('MCP preserves unknown names and rejects unregistered tools', async () => {
  const { server, client } = await connect();
  try {
    const known = await client.callTool({ name: 'get_company', arguments: { id: ID } });
    assert.deepEqual(known.structuredContent, { source: 'twenty', retrievedAt: '2026-01-02T03:04:05.000Z', record: { id: ID, name: null } });
    await assert.rejects(client.callTool({ name: 'delete_company', arguments: { id: ID } }));
  } finally {
    await client.close(); await server.close();
  }
});


test('concurrent MCP calls share the Twenty adapter request cap', async () => {
  let started = 0;
  let constructed = 0;
  let releaseResponses!: () => void;
  let notifyTwoStarted!: () => void;
  let notifyThreeStarted!: () => void;
  const held = new Promise<void>((resolve) => { releaseResponses = resolve; });
  const twoStarted = new Promise<void>((resolve) => { notifyTwoStarted = resolve; });
  const threeStarted = new Promise<void>((resolve) => { notifyThreeStarted = resolve; });
  const fetchImpl: typeof fetch = async () => {
    started++;
    if (started === 2) notifyTwoStarted();
    if (started === 3) notifyThreeStarted();
    await held;
    return Response.json({ data: { people: [{ id: ID, name: { firstName: 'Ada', lastName: 'Lovelace' } }] }, totalCount: 1, pageInfo: { hasNextPage: false, endCursor: null } });
  };
  const server = createMcpServer({
    getPort: () => {
      constructed++;
      return createTwentyReadPort({ baseUrl: 'https://crm.example.test', apiKey: 'synthetic-test-key', fetchImpl });
    },
  });
  const client = new Client({ name: 'concurrency-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const first = client.callTool({ name: 'list_people', arguments: { limit: 1 } });
    const second = client.callTool({ name: 'list_people', arguments: { limit: 1 } });
    await Promise.race([twoStarted, new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('first two requests did not start')), 1000))]);
    const third = client.callTool({ name: 'list_people', arguments: { limit: 1 } });
    const state = await Promise.race([
      third.then((result) => ({ result, admitted: started })),
      threeStarted.then(() => ({ result: null, admitted: started })),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('third request stalled')), 1000)),
    ]);
    releaseResponses();
    await Promise.all([first, second]);
    const result = state.result ?? await third;
    assert.equal(state.admitted, 2, 'the third CRM request must not reach fetch');
    assert.equal(constructed, 1, 'all calls on one server must share one adapter');
    assert.equal(result.isError, true);
    assert.deepEqual(JSON.parse((result.content[0] as { text: string }).text), {
      code: 'concurrency_limit', message: 'Too many concurrent CRM requests.',
    });
  } finally {
    releaseResponses();
    await client.close(); await server.close();
  }
});
