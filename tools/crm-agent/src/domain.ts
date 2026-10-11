export interface CrmRecord {
  id: string;
  name: string | null;
}

export interface CrmPage {
  records: CrmRecord[];
  nextCursor: string | null;
}

export interface PageInput {
  limit?: number;
  cursor?: string;
}

export interface CrmReadPort {
  listPeople(input: PageInput): Promise<CrmPage>;
  getPerson(id: string): Promise<CrmRecord>;
  listCompanies(input: PageInput): Promise<CrmPage>;
  getCompany(id: string): Promise<CrmRecord>;
}

export const SOURCE_SYSTEM = 'twenty' as const;
export const MAX_PAGE_LIMIT = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURSOR = /^[\x21-\x7e]{1,256}$/;

export class CrmError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'CrmError';
  }
}

export function validateId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new CrmError('invalid_input', 'A valid record UUID is required.');
  }
  return value;
}

export function validatePage(input: PageInput): Required<Pick<PageInput, 'limit'>> & Pick<PageInput, 'cursor'> {
  const limit = input.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new CrmError('invalid_input', 'Page limit must be an integer from 1 to 25.');
  }
  if (input.cursor !== undefined && (typeof input.cursor !== 'string' || !CURSOR.test(input.cursor))) {
    throw new CrmError('invalid_input', 'Cursor is invalid or too long.');
  }
  return { limit, ...(input.cursor === undefined ? {} : { cursor: input.cursor }) };
}

export function validateCursor(value: unknown): string {
  if (typeof value !== 'string' || !CURSOR.test(value)) {
    throw new CrmError('invalid_response', 'CRM response is invalid.');
  }
  return value;
}
