import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import test from 'node:test';

const packageRoot = new URL('..', import.meta.url);
const checkPath = new URL('../scripts/check.mjs', import.meta.url);

function runWithFakePnpm(failStep?: string) {
  const directory = mkdtempSync(join(tmpdir(), 'crm-agent-check-'));
  const log = join(directory, 'calls.jsonl');
  const executable = join(directory, process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  const script = join(directory, 'fake-pnpm.mjs');
  writeFileSync(script, `import { appendFileSync } from 'node:fs';
appendFileSync(process.env.FAKE_LOG, JSON.stringify({
  args: process.argv.slice(2),
  hasCrmUrl: Boolean(process.env.COMINORSA_CRM_URL),
  hasCrmKey: Boolean(process.env.COMINORSA_CRM_API_KEY),
  hasNetworkFlag: Boolean(process.env.COMINORSA_CRM_ALLOW_NETWORK)
}) + '\\n');
if (process.argv.includes(process.env.FAKE_FAIL_STEP)) process.exit(17);
if (process.argv.includes(process.env.FAKE_SIGNAL_STEP)) process.kill(process.pid, 'SIGTERM');
`);
  if (process.platform === 'win32') {
    writeFileSync(executable, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
  } else {
    writeFileSync(executable, `#!${process.execPath}\nimport '${script}';\n`);
    chmodSync(executable, 0o755);
  }
  const result = spawnSync(process.execPath, [checkPath.pathname], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}${delimiter}${process.env.PATH ?? ''}`,
      FAKE_LOG: log,
      FAKE_FAIL_STEP: failStep ?? '',
      COMINORSA_CRM_URL: 'https://example.invalid',
      COMINORSA_CRM_API_KEY: 'fixture-only',
      COMINORSA_CRM_ALLOW_NETWORK: '1',
    },
  });
  const calls = existsSync(log)
    ? readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    : [];
  rmSync(directory, { recursive: true, force: true });
  return { result, calls };
}

test('check runs package tests, typecheck and offline discovery without CRM environment', () => {
  const { result, calls } = runWithFakePnpm();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.map((call) => call.args), [
    ['--ignore-workspace', 'test'],
    ['--ignore-workspace', 'typecheck'],
  ]);
  assert.ok(calls.every((call) => !call.hasCrmUrl && !call.hasCrmKey && !call.hasNetworkFlag));
  assert.match(result.stdout, /4 read-only tools/);
});

test('check propagates a failing package test and skips later checks', () => {
  const { result, calls } = runWithFakePnpm('test');
  assert.equal(result.status, 17);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.args, ['--ignore-workspace', 'test']);
});
