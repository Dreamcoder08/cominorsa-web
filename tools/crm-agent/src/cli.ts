#!/usr/bin/env node
import { createToolRegistry, listToolDefinitions, CrmError } from './index.ts';
import { createConfiguredReadPort } from './config.ts';

const HELP = 'Usage: pnpm cli list-tools | call <tool-name> <json-input>\n';

async function main(args: string[]): Promise<void> {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    process.stdout.write(HELP);
    return;
  }
  if (args.length === 1 && args[0] === 'list-tools') {
    process.stdout.write(`${JSON.stringify(listToolDefinitions())}\n`);
    return;
  }
  if (args.length !== 3 || args[0] !== 'call') throw new CrmError('invalid_command', 'Invalid CLI command.');
  let input: unknown;
  try { input = JSON.parse(args[2]!); }
  catch { throw new CrmError('invalid_input', 'Tool input must be valid JSON.'); }
  const registry = createToolRegistry(createConfiguredReadPort(process.env));
  const result = await registry.callTool(args[1]!, input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const safe = error instanceof CrmError ? error : new CrmError('internal_error', 'CRM tool failed.');
  process.stderr.write(`${JSON.stringify({ code: safe.code, message: safe.message })}\n`);
  process.exitCode = 1;
});
