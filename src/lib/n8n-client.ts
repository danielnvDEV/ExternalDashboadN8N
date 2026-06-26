/**
 * Server-side n8n client. Reads N8N_BASE_URL + N8N_API_KEY from env.
 * NEVER import this file from a client component.
 */
import { getEnv } from './env';

// Node's built-in fetch (via undici) accepts a `dispatcher` option to control
// TLS verification. We use it to honor N8N_VERIFY_TLS=false for self-signed
// local n8n instances. The dispatcher type comes from undici which is a
// transitive dep of Node 18+; we type it locally to avoid a hard import.
type Dispatcher = { connect?: { rejectUnauthorized?: boolean } };
type AgentCtor = new (opts?: { connect?: { rejectUnauthorized?: boolean } }) => Dispatcher;

interface NodeGlobalWithUndici {
  Agent?: AgentCtor;
}

let cachedDispatcher: Dispatcher | undefined;

function getInsecureDispatcher(): Dispatcher | undefined {
  if (cachedDispatcher) return cachedDispatcher;
  const Agent = (globalThis as unknown as NodeGlobalWithUndici).Agent;
  if (!Agent) return undefined;
  cachedDispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  return cachedDispatcher;
}

export class N8nError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly hint?: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'N8nError';
  }
}

export interface N8nRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  formData?: FormData;
  /** Raw response (for binary endpoints like /n8n-packages/export). */
  raw?: boolean;
  /** Override per-request timeout in ms. */
  timeoutMs?: number;
  /** Forward an incoming request signal (for cancellation). */
  signal?: AbortSignal;
}

function buildUrl(
  path: string,
  query?: N8nRequestOptions['query'],
): string {
  const { N8N_BASE_URL } = getEnv();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${N8N_BASE_URL}/api/v1${cleanPath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'boolean') {
        url.searchParams.set(k, v ? 'true' : 'false');
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

function hintForStatus(status: number, method: string): string | undefined {
  if (status === 401) {
    return 'Authentication failed. Verify N8N_API_KEY is valid and the key has not been deleted.';
  }
  if (status === 403) {
    return 'Forbidden. The API key may not have the required scope, or the resource is owner/admin only.';
  }
  if (status === 404) {
    return 'Not found. The resource may not exist, or the feature may not be available in your n8n edition (e.g. Enterprise features, n8n Packages beta).';
  }
  if (status === 409) {
    return 'Conflict. Duplicate resource, source-control conflict, or concurrent edit. Retry with force=true where applicable.';
  }
  if (status === 422) {
    return 'Unprocessable. Often related to redaction policy on executions.';
  }
  if (status === 500) {
    return 'Internal n8n error. Check the n8n server logs.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'n8n is unreachable or unhealthy. Verify N8N_BASE_URL and connectivity.';
  }
  if (status === 415) {
    return `Unsupported media type for ${method} request.`;
  }
  return undefined;
}

export async function n8nRequest<T = unknown>(
  path: string,
  opts: N8nRequestOptions = {},
): Promise<T> {
  const env = getEnv();
  const url = buildUrl(path, opts.query);
  const method = opts.method ?? 'GET';
  const timeout = opts.timeoutMs ?? env.N8N_TIMEOUT_MS;

  const headers: Record<string, string> = {
    'X-N8N-API-KEY': env.N8N_API_KEY,
    Accept: 'application/json',
  };

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
    // Do not set Content-Type; fetch will set the multipart boundary.
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeout);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort('caller-aborted');
    else opts.signal.addEventListener('abort', () => controller.abort('caller-aborted'));
  }

  const started = Date.now();
  let res: Response;
  try {
    const dispatcher =
      process.env.NEXT_RUNTIME === 'nodejs' && !env.N8N_VERIFY_TLS
        ? getInsecureDispatcher()
        : undefined;
    res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      // Disable Next.js fetch cache for live data
      cache: 'no-store',
      // Node-only: undici dispatcher to honor N8N_VERIFY_TLS=false.
      // The `dispatcher` option is not in the DOM RequestInit type.
      ...(dispatcher ? ({ dispatcher } as unknown as RequestInit) : {}),
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    throw new N8nError(
      `Network error talking to n8n at ${env.N8N_BASE_URL}: ${msg}`,
      0,
      'Verify N8N_BASE_URL is reachable and the API is enabled.',
    );
  } finally {
    clearTimeout(timeoutId);
  }
  const elapsed = Date.now() - started;

  // Server-side log (off by default; enable with N8N_DEBUG_LOG=1)
  if (process.env.NODE_ENV !== 'test' && process.env.N8N_DEBUG_LOG === '1') {
    // eslint-disable-next-line no-console
    console.log(
      `[n8n] ${method} ${path} -> ${res.status} (${elapsed}ms)`,
    );
  }

  if (opts.raw) {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new N8nError(
        `n8n ${method} ${path} failed: ${res.status} ${res.statusText}`,
        res.status,
        hintForStatus(res.status, method),
        text,
      );
    }
    return res as unknown as T;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => undefined) : await res.text();

  if (!res.ok) {
    throw new N8nError(
      `n8n ${method} ${path} failed: ${res.status} ${res.statusText}`,
      res.status,
      hintForStatus(res.status, method),
      payload,
    );
  }

  return payload as T;
}

/** Helper: pass an unknown body straight to a passthrough proxy. */
export function passthroughBody(input: unknown): unknown {
  return input;
}
