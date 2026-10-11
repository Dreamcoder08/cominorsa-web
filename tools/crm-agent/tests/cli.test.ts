import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function run(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ['src/cli.ts', ...args], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
}

test('list-tools is usable with no CRM configuration', () => {
  const result = run(['list-tools']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).map((tool: {name: string}) => tool.name), ['list_people', 'get_person', 'list_companies', 'get_company']);
});

test('help is usable with no CRM configuration', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /list-tools/);
});

test('call fails closed without network flag and does not echo secret arguments', () => {
  const result = run(['call', 'list_people', '{"endpoint":"secret-person"}'], { COMINORSA_CRM_URL: 'https://crm.example.test', COMINORSA_CRM_API_KEY: 'secret-api-key' });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /secret-person|secret-api-key|crm.example.test/);
});

test('malformed JSON is denied without echoing the argument', () => {
  const result = run(['call', 'list_people', '{"secret":"private' ], {
    COMINORSA_CRM_ALLOW_NETWORK: '1', COMINORSA_CRM_URL: 'http://127.0.0.1:1234', COMINORSA_CRM_API_KEY: 'key',
  });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /private/);
  assert.match(result.stderr, /invalid_input/);
});

test('write tool and unsupported filter are denied without a network connection', () => {
  const env = { COMINORSA_CRM_ALLOW_NETWORK: '1', COMINORSA_CRM_URL: 'http://127.0.0.1:1234', COMINORSA_CRM_API_KEY: 'key' };
  for (const args of [['call', 'delete_person', '{}'], ['call', 'list_people', '{"filter":"all"}']]) {
    const result = run(args, env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown_tool|invalid_input/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|127\.0\.0\.1|key/);
  }
});
