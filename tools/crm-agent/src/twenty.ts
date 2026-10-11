import { CrmError, validateCursor, validateId, validatePage } from './domain.ts';
import type { CrmPage, CrmReadPort, CrmRecord, PageInput } from './domain.ts';

export interface TwentyOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

type ObjectKind = 'people' | 'companies';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 64 * 1024;
const MAX_ACTIVE = 2;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function configError(): CrmError {
  return new CrmError('invalid_configuration', 'CRM configuration is invalid.');
}

function validateOrigin(baseUrl: string): string {
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw configError(); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw configError();
  }
  return url.origin;
}

function normalizeRecord(value: unknown, kind: ObjectKind): CrmRecord {
  if (!isObject(value)) throw new CrmError('invalid_response', 'CRM response is invalid.');
  const id = validateResponseId(value.id);
  let name: string | null;
  if (kind === 'companies') {
    if (value.name !== null && value.name !== undefined && typeof value.name !== 'string') {
      throw new CrmError('invalid_response', 'CRM response is invalid.');
    }
    name = typeof value.name === 'string' ? value.name.trim() || null : null;
  } else if (value.name === null || value.name === undefined) {
    name = null;
  } else if (isObject(value.name)) {
    const first = value.name.firstName;
    const last = value.name.lastName;
    if (![first, last].every((part) => part === null || part === undefined || typeof part === 'string')) {
      throw new CrmError('invalid_response', 'CRM response is invalid.');
    }
    name = [first, last].filter((part): part is string => typeof part === 'string' && part.trim() !== '').map((part) => part.trim()).join(' ') || null;
  } else {
    throw new CrmError('invalid_response', 'CRM response is invalid.');
  }
  return { id, name };
}

function validateResponseId(value: unknown): string {
  try { return validateId(value); } catch { throw new CrmError('invalid_response', 'CRM response is invalid.'); }
}

function parsePage(value: unknown, kind: ObjectKind, limit: number): CrmPage {
  if (!isObject(value) || !isObject(value.data) || !Array.isArray(value.data[kind])) {
    throw new CrmError('invalid_response', 'CRM response is invalid.');
  }
  const raw = value.data[kind] as unknown[];
  if (raw.length > limit) throw new CrmError('invalid_response', 'CRM response is invalid.');
  const records = raw.map((item) => normalizeRecord(item, kind));
  const pageInfo = value.pageInfo;
  if (!isObject(pageInfo) || typeof pageInfo.hasNextPage !== 'boolean') {
    throw new CrmError('invalid_response', 'CRM response is invalid.');
  }
  return { records, nextCursor: pageInfo.hasNextPage ? validateCursor(pageInfo.endCursor) : null };
}

function parseOne(value: unknown, kind: ObjectKind): CrmRecord {
  const key = kind === 'people' ? 'person' : 'company';
  if (!isObject(value) || !isObject(value.data)) {
    throw new CrmError('invalid_response', 'CRM response is invalid.');
  }
  return normalizeRecord(value.data[key], kind);
}

async function readBoundedBody(response: Response, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw new CrmError('invalid_response', 'CRM response is invalid.');
  const reader = response.body.getReader();
  const cancelOnAbort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancelOnAbort, { once: true });
  if (signal.aborted) cancelOnAbort();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new CrmError('response_too_large', 'CRM response exceeds the size limit.');
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener('abort', cancelOnAbort);
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; }
  catch { throw new CrmError('invalid_response', 'CRM response is invalid.'); }
}

export function createTwentyReadPort(options: TwentyOptions): CrmReadPort {
  const origin = validateOrigin(options.baseUrl);
  if (typeof options.apiKey !== 'string' || !options.apiKey.trim() || options.apiKey !== options.apiKey.trim() || /[\r\n]/.test(options.apiKey)) {
    throw configError();
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxResponseBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 * 1024) {
    throw configError();
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let active = 0;

  async function request(path: string, params: URLSearchParams): Promise<unknown> {
    if (active >= MAX_ACTIVE) throw new CrmError('concurrency_limit', 'Too many concurrent CRM requests.');
    active++;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new CrmError('timeout', 'CRM request timed out.'));
      }, timeoutMs);
    });
    const operation = async (): Promise<unknown> => {
      const url = new URL(path, origin);
      url.search = params.toString();
      const response = await fetchImpl(url.toString(), {
        method: 'GET', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${options.apiKey}`, Accept: 'application/json' },
      });
      if (response.redirected || response.status >= 300 && response.status < 400) {
        throw new CrmError('redirect_denied', 'CRM redirect was denied.');
      }
      if (!response.ok) {
        throw new CrmError(response.status === 401 || response.status === 403 ? 'auth_failed' : 'http_error', 'CRM request failed.');
      }
      return readBoundedBody(response, maxBytes, controller.signal);
    };
    try {
      return await Promise.race([operation(), timeout]);
    } catch (error) {
      if (timedOut) throw new CrmError('timeout', 'CRM request timed out.');
      if (error instanceof CrmError) throw error;
      throw new CrmError('unavailable', 'CRM request is unavailable.');
    } finally {
      if (timer) clearTimeout(timer);
      active--;
    }
  }

  async function list(kind: ObjectKind, input: PageInput): Promise<CrmPage> {
    const page = validatePage(input);
    const params = new URLSearchParams({ fields: 'id,name', depth: '0', limit: String(page.limit) });
    if (page.cursor !== undefined) params.set('starting_after', page.cursor);
    return parsePage(await request(`/rest/${kind}`, params), kind, page.limit);
  }
  async function get(kind: ObjectKind, id: string): Promise<CrmRecord> {
    const safeId = validateId(id);
    const params = new URLSearchParams({ fields: 'id,name', depth: '0' });
    return parseOne(await request(`/rest/${kind}/${safeId}`, params), kind);
  }
  return {
    listPeople: (input) => list('people', input),
    getPerson: (id) => get('people', id),
    listCompanies: (input) => list('companies', input),
    getCompany: (id) => get('companies', id),
  };
}
