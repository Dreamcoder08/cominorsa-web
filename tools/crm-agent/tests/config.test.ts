import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConfiguredReadPort } from '../src/config.ts';

const ID = '11111111-1111-4111-8111-111111111111';
const fixture = { data: { people: [{ id: ID, name: { firstName: 'Ada', lastName: 'Lovelace' } }] }, totalCount: 1, pageInfo: { hasNextPage: false, endCursor: null } };

test('configured port requires an exact network opt-in and both dedicated credentials', () => {
  const target = { COMINORSA_CRM_URL: 'https://crm.example.test', COMINORSA_CRM_API_KEY: 'synthetic-test-key' };
  assert.throws(() => createConfiguredReadPort(target), (error: Error & {code?: string}) => error.code === 'network_denied');
  assert.throws(() => createConfiguredReadPort({ ...target, COMINORSA_CRM_ALLOW_NETWORK: 'true' }), (error: Error & {code?: string}) => error.code === 'network_denied');
  assert.throws(() => createConfiguredReadPort({ COMINORSA_CRM_ALLOW_NETWORK: '1' }), (error: Error & {code?: string}) => error.code === 'missing_configuration');
});

test('configured port with explicit env uses the Twenty read adapter', async () => {
  const env = { COMINORSA_CRM_ALLOW_NETWORK: '1', COMINORSA_CRM_URL: 'https://crm.example.test', COMINORSA_CRM_API_KEY: 'synthetic-test-key' };
  let calls = 0;
  const port = createConfiguredReadPort(env, async (_url, init) => {
    calls++;
    assert.equal(init?.method, 'GET');
    return Response.json(fixture);
  });
  assert.deepEqual(await port.listPeople({}), { records: [{ id: ID, name: 'Ada Lovelace' }], nextCursor: null });
  assert.equal(calls, 1);
});
