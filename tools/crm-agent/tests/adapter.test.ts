import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTwentyReadPort } from '../src/index.ts';

const ID = '11111111-1111-4111-8111-111111111111';
const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const BASE = 'https://crm.example.test';
const people = { data: { people: [{ id: ID, name: { firstName: 'Ada', lastName: 'Lovelace' }, emails: { primaryEmail: 'private@example.test' } }] }, pageInfo: { hasNextPage: true, endCursor: 'next==/' }, totalCount: 50 };
const companies = { data: { companies: [{ id: COMPANY_ID, name: 'Foundry', phone: 'private' }] }, pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 1 };
function port(fetchImpl: typeof fetch, options = {}) {
  return createTwentyReadPort({ baseUrl: BASE, apiKey: 'secret-api-key', fetchImpl, ...options });
}

test('people list uses allowlisted GET, explicit fields, bounded page, and strips extra PII', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const crm = port(async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json(people);
  });
  const result = await crm.listPeople({ limit: 2, cursor: 'previous' });
  assert.deepEqual(result, {
    records: [{ id: ID, name: 'Ada Lovelace' }], nextCursor: 'next==/',
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.init?.method, 'GET');
  assert.equal(requests[0]?.init?.redirect, 'error');
  const url = new URL(requests[0]!.url);
  assert.equal(url.origin, BASE);
  assert.equal(url.pathname, '/rest/people');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    fields: 'id,name', depth: '0', limit: '2', starting_after: 'previous',
  });
  assert.equal(new Headers(requests[0]?.init?.headers).get('Authorization'), 'Bearer secret-api-key');
});

test('company list defaults to ten and gives no cursor unless hasNextPage', async () => {
  let requested = '';
  const crm = port(async (url) => { requested = String(url); return Response.json(companies); });
  assert.deepEqual(await crm.listCompanies({}), { records: [{ id: COMPANY_ID, name: 'Foundry' }], nextCursor: null });
  assert.equal(new URL(requested).searchParams.get('limit'), '10');
});

test('single reads use UUID path and normalize only id and name', async () => {
  const paths: string[] = [];
  const crm = port(async (url) => {
    const path = new URL(String(url)).pathname;
    paths.push(path);
    return Response.json(path.includes('people') ? { data: { person: people.data.people[0] } } : { data: { company: companies.data.companies[0] } });
  });
  assert.deepEqual(await crm.getPerson(ID), { id: ID, name: 'Ada Lovelace' });
  assert.deepEqual(await crm.getCompany(COMPANY_ID), { id: COMPANY_ID, name: 'Foundry' });
  assert.deepEqual(paths, [`/rest/people/${ID}`, `/rest/companies/${COMPANY_ID}`]);
});

test('invalid identifiers and list bounds cause no request', async () => {
  let requests = 0;
  const crm = port(async () => { requests++; return Response.json(people); });
  await assert.rejects(crm.getPerson('../bad'));
  await assert.rejects(crm.getCompany('x'));
  await assert.rejects(crm.listPeople({ limit: 26 }));
  await assert.rejects(crm.listPeople({ limit: 0 }));
  await assert.rejects(crm.listPeople({ cursor: 'x'.repeat(257) }));
  assert.equal(requests, 0);
});

test('malformed envelopes and unexpected record fields fail closed without echoing body', async () => {
  for (const bad of [{ data: { people: 'bad' } }, { data: { people: [{ id: ID, name: 42 }] } }, { data: { people: [{ id: 'bad', name: 'Private' }] } }, { data: { people: [] }, pageInfo: { hasNextPage: true } }]) {
    const crm = port(async () => Response.json(bad));
    await assert.rejects(crm.listPeople({}), (error: Error) => !error.message.includes('Private') && !error.message.includes('secret'));
  }
});

test('HTTP errors, thrown transport errors and redirects are sanitized', async () => {
  for (const fetchImpl of [
    async () => new Response('secret-api-key private record', { status: 500 }),
    async () => { throw new Error('secret-api-key https://crm.example.test/private'); },
    async () => new Response('redirect', { status: 302, headers: { location: 'https://evil.test' } }),
  ]) {
    const crm = port(fetchImpl);
    await assert.rejects(crm.listPeople({}), (error: Error) => !/secret-api-key|private record|evil.test|crm.example.test/.test(error.message));
  }
});

test('response byte cap rejects oversized chunked bodies', async () => {
  const crm = port(async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('a'.repeat(80)));
      controller.enqueue(new TextEncoder().encode('b'.repeat(80)));
      controller.close();
    },
  })), { maxResponseBytes: 100 });
  await assert.rejects(crm.listPeople({}), /response/i);
});

test('timeout aborts a pending request and returns a safe error', async () => {
  let aborted = false;
  const crm = port(async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('secret-api-key')); });
  }), { timeoutMs: 15 });
  await assert.rejects(crm.listPeople({}), (error: Error & {code?: string}) => error.code === 'timeout' && !error.message.includes('secret-api-key'));
  assert.equal(aborted, true);
});

test('at most two requests are active and the third is denied', async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let entered = 0;
  const crm = port(async () => { entered++; await held; return Response.json(people); });
  const a = crm.listPeople({});
  const b = crm.listPeople({});
  await assert.rejects(crm.listPeople({}), /concurrent/i);
  assert.equal(entered, 2);
  release();
  await Promise.all([a, b]);
});

test('configured origin rejects secrets and non-loopback plaintext', () => {
  const fetchImpl = async () => Response.json(people);
  for (const baseUrl of ['http://crm.example.test', 'https://user:pass@crm.example.test', 'https://crm.example.test/?token=secret', 'https://crm.example.test/#x', 'https://crm.example.test/api']) {
    assert.throws(() => createTwentyReadPort({ baseUrl, apiKey: 'key', fetchImpl }), /configuration/i);
  }
  assert.doesNotThrow(() => createTwentyReadPort({ baseUrl: 'http://127.0.0.1:3000', apiKey: 'key', fetchImpl }));
});

test('a transport that follows a redirect is rejected even after a 200 response', async () => {
  const crm = port(async () => {
    const response = Response.json(people);
    Object.defineProperty(response, 'redirected', { value: true });
    return response;
  });
  await assert.rejects(crm.listPeople({}), (error: Error & { code?: string }) => error.code === 'redirect_denied');
});

test('invalid JSON is rejected without exposing its contents', async () => {
  const crm = port(async () => new Response('{"name":"Private Person"'));
  await assert.rejects(crm.listPeople({}), (error: Error & { code?: string }) => error.code === 'invalid_response' && !error.message.includes('Private Person'));
});

test('missing person name remains unknown rather than inferred', async () => {
  const crm = port(async () => Response.json({ data: { person: { id: ID, email: 'private@example.test' } } }));
  assert.deepEqual(await crm.getPerson(ID), { id: ID, name: null });
});

test('official Twenty root pageInfo exposes an explicit next cursor', async () => {
  const crm = port(async () => Response.json({
    data: { people: [{ id: ID, name: { firstName: 'Ada', lastName: 'Lovelace' } }] },
    totalCount: 50,
    pageInfo: { hasNextPage: true, endCursor: 'official-next' },
  }));
  assert.deepEqual(await crm.listPeople({ limit: 2 }), {
    records: [{ id: ID, name: 'Ada Lovelace' }], nextCursor: 'official-next',
  });
});

test('missing root pagination metadata is rejected rather than silently truncating a list', async () => {
  const crm = port(async () => Response.json({ data: { people: [{ id: ID, name: null }] } }));
  await assert.rejects(crm.listPeople({}), (error: Error & { code?: string }) => error.code === 'invalid_response');
});

test('deadline cancels an already-open response stream', async () => {
  let cancelled = false;
  const crm = port(async () => new Response(new ReadableStream({
    cancel() { cancelled = true; },
  })), { timeoutMs: 15 });
  await assert.rejects(crm.listPeople({}), (error: Error & { code?: string }) => error.code === 'timeout');
  assert.equal(cancelled, true);
});
