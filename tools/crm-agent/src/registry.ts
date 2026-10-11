import { CrmError, SOURCE_SYSTEM, validateId, validatePage } from './domain.ts';
import type { CrmReadPort, CrmRecord, PageInput } from './domain.ts';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolResult {
  source: typeof SOURCE_SYSTEM;
  retrievedAt: string;
  records?: CrmRecord[];
  record?: CrmRecord;
  nextCursor?: string | null;
}

const listSchema = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: { limit: { type: 'integer', minimum: 1, maximum: 25 }, cursor: { type: 'string', minLength: 1, maxLength: 256 } },
});
const getSchema = Object.freeze({
  type: 'object', additionalProperties: false, required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
});
const TOOLS: readonly ToolDefinition[] = Object.freeze([
  { name: 'list_people', description: 'List up to 25 Twenty people by id and name.', inputSchema: listSchema },
  { name: 'get_person', description: 'Get one Twenty person by UUID, id and name only.', inputSchema: getSchema },
  { name: 'list_companies', description: 'List up to 25 Twenty companies by id and name.', inputSchema: listSchema },
  { name: 'get_company', description: 'Get one Twenty company by UUID, id and name only.', inputSchema: getSchema },
]);

export function listToolDefinitions(): readonly ToolDefinition[] {
  return TOOLS;
}

function objectInput(input: unknown, allowed: readonly string[], required: readonly string[] = []): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new CrmError('invalid_input', 'Tool input must be an object.');
  }
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(value, key))) {
    throw new CrmError('invalid_input', 'Tool input contains missing or unsupported fields.');
  }
  return value;
}

export function createToolRegistry(port: CrmReadPort, now: () => Date = () => new Date()) {
  return {
    listTools(): readonly ToolDefinition[] { return listToolDefinitions(); },
    async callTool(name: string, input: unknown): Promise<ToolResult> {
      if (!TOOLS.some((tool) => tool.name === name)) throw new CrmError('unknown_tool', 'Tool is not allowed.');
      if (name === 'list_people' || name === 'list_companies') {
        const raw = objectInput(input, ['limit', 'cursor']);
        const page = validatePage(raw as PageInput);
        const result = name === 'list_people' ? await port.listPeople(page) : await port.listCompanies(page);
        return { source: SOURCE_SYSTEM, retrievedAt: now().toISOString(), records: result.records, nextCursor: result.nextCursor };
      }
      const raw = objectInput(input, ['id'], ['id']);
      const id = validateId(raw.id);
      const record = name === 'get_person' ? await port.getPerson(id) : await port.getCompany(id);
      return { source: SOURCE_SYSTEM, retrievedAt: now().toISOString(), record };
    },
  };
}
