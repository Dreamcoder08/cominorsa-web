#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const cliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const env = { ...process.env };
delete env.COMINORSA_CRM_URL;
delete env.COMINORSA_CRM_API_KEY;
delete env.COMINORSA_CRM_ALLOW_NETWORK;

function run(label, command, args, capture = false) {
  process.stdout.write(`Checking ${label}...\n`);
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    env,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32' && command === pnpm,
  });
  if (result.error || result.signal || result.status === null) {
    process.stderr.write(`${label} could not complete.\n`);
    process.exit(result.status || 1);
  }
  if (result.status !== 0) process.exit(result.status);
  return result.stdout ?? '';
}

run('package tests', pnpm, ['--ignore-workspace', 'test']);
run('strict typecheck', pnpm, ['--ignore-workspace', 'typecheck']);
const discovery = run('offline tool discovery', process.execPath, [cliPath, 'list-tools'], true);
try {
  const tools = JSON.parse(discovery);
  const names = tools.map((tool) => tool.name).sort();
  const expected = ['get_company', 'get_person', 'list_companies', 'list_people'];
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error('unexpected tool list');
} catch {
  process.stderr.write('Offline tool discovery returned an invalid tool list.\n');
  process.exit(1);
}
process.stdout.write('CRM agent checks passed: 4 read-only tools.\n');
