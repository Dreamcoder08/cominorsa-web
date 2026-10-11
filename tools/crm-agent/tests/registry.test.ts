import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createToolRegistry, type CrmReadPort } from '../src/index.ts';

test('registry exposes only four named read tools', () => {
  const registry = createToolRegistry({} as CrmReadPort);
  assert.deepEqual(registry.listTools().map((tool: unknown) => (tool as {name: string}).name), [
    'list_people', 'get_person', 'list_companies', 'get_company',
  ]);
});

test('registry denies unknown tools and unrecognized fields before invoking the port', async () => {
  let invoked = 0;
  const registry = createToolRegistry({
    listPeople: async () => { invoked++; return { records: [], nextCursor: null }; },
    getPerson: async () => { invoked++; return { id: 'x', name: null }; },
    listCompanies: async () => { invoked++; return { records: [], nextCursor: null }; },
    getCompany: async () => { invoked++; return { id: 'x', name: null }; },
  });
  await assert.rejects(registry.callTool('delete_person', {}));
  await assert.rejects(registry.callTool('list_people', { endpoint: '/rest/opportunities' }));
  await assert.rejects(registry.callTool('get_person', { id: 'x', fields: ['email'] }));
  assert.equal(invoked, 0);
});

test('successful result includes Twenty provenance and retrieval time, not extra data', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const registry = createToolRegistry({
    listPeople: async () => ({ records: [{ id, name: 'Ada' }], nextCursor: null }),
    getPerson: async () => ({ id, name: 'Ada' }),
    listCompanies: async () => ({ records: [], nextCursor: null }),
    getCompany: async () => ({ id, name: null }),
  }, () => new Date('2026-01-02T03:04:05.000Z'));
  assert.deepEqual(await registry.callTool('get_person', { id }), {
    source: 'twenty', retrievedAt: '2026-01-02T03:04:05.000Z', record: { id, name: 'Ada' },
  });
});
