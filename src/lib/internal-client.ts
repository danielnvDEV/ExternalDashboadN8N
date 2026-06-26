/**
 * Server-side client for n8n's INTERNAL REST API (`/rest/...`).
 *
 * The public API key (`N8N_API_KEY`) does NOT work against `/rest/`; n8n
 * expects a session cookie issued by `POST /rest/login`. This module:
 *
 *   1. Reads `N8N_INTERNAL_EMAIL` / `N8N_INTERNAL_PASSWORD` from env.
 *   2. Logs in once via POST /rest/login and caches the Set-Cookie in a
 *      23-hour TTL file (see `session-cache.ts`).
 *   3. On 401 from a downstream call, clears the cache, re-logs in, and
 *      retries the request exactly once.
 *
 * One shared login for the entire dashboard process (intended: a dedicated
 * service-account user in n8n). NOT meant for browser-side use.
 */
import { getEnv, isHttpBaseUrl } from './env';
import { clearSession, readSession, writeSession } from './session-cache';

const SESSION_KEY = 'n8n-internal';
const SESSION_TTL_MS = 23 * 60 * 60 * 1000;

export class N8nInternalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly hint?: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'N8nInternalError';
  }
}

interface CachedCookie {
  cookie: string;
}

function dispatcherFor(): { connect?: { rejectUnauthorized?: boolean } } | undefined {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return undefined;
  const env = getEnv();
  if (!env.N8N_VERIFY_TLS) {
    const Agent = (globalThis as { Agent?: new (o?: { connect?: { rejectUnauthorized?: boolean } }) => unknown }).Agent;
    if (Agent) {
      return new Agent({ connect: { rejectUnauthorized: false } }) as { connect?: { rejectUnauthorized?: boolean } };
    }
  }
  return undefined;
}

export function isInternalApiConfigured(): boolean {
  try {
    const env = getEnv();
    return !!env.N8N_INTERNAL_EMAIL && !!env.N8N_INTERNAL_PASSWORD;
  } catch {
    return false;
  }
}

export interface InternalStatus {
  configured: boolean;
  /** A live call to /rest/projects succeeded. */
  reachable: boolean;
  /** We have a cached cookie that's still within TTL. */
  cached: boolean;
  /** n8n version string, when reachable. */
  version?: string;
  baseUrl?: string;
  error?: string;
}

async function fetchWithDispatcher(url: string, init: RequestInit): Promise<Response> {
  const dispatcher = dispatcherFor();
  return fetch(url, {
    ...init,
    cache: 'no-store',
    ...(dispatcher ? ({ dispatcher } as unknown as RequestInit) : {}),
  });
}

async function performLogin(): Promise<string> {
  const env = getEnv();
  if (!env.N8N_INTERNAL_EMAIL || !env.N8N_INTERNAL_PASSWORD) {
    throw new N8nInternalError(
      'Internal API is not configured. Set N8N_INTERNAL_EMAIL and N8N_INTERNAL_PASSWORD in .env.',
      0,
      'See .env.example for setup instructions.',
    );
  }
  const url = `${env.N8N_BASE_URL}/rest/login`;
  const started = Date.now();
  const res = await fetchWithDispatcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      emailOrLdapLoginId: env.N8N_INTERNAL_EMAIL,
      password: env.N8N_INTERNAL_PASSWORD,
    }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) detail = body.message;
    } catch {
      /* ignore */
    }
    throw new N8nInternalError(
      `Login to n8n internal API failed: ${detail}`,
      res.status,
      res.status === 401
        ? 'Verify N8N_INTERNAL_EMAIL and N8N_INTERNAL_PASSWORD are valid n8n user credentials.'
        : undefined,
    );
  }

  // Headers#getSetCookie is available in Node 20+ via undici.
  const setCookies = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  if (setCookies.length === 0) {
    throw new N8nInternalError(
      'Login succeeded but n8n did not return a session cookie. The /rest/login endpoint may be disabled (N8N_USER_MANAGEMENT_DISABLED=true).',
      res.status,
      'Enable user management on the n8n instance, or use the public API key.',
    );
  }

  // Reduce to name=value pairs. n8n's cookies are HttpOnly + same-site; we
  // don't need those attributes when echoing them back on the server side.
  const cookie = setCookies
    .map((c) => c.split(';')[0]?.trim() ?? '')
    .filter(Boolean)
    .join('; ');

  if (!cookie) {
    throw new N8nInternalError('Login returned an empty cookie payload.', res.status);
  }

  // eslint-disable-next-line no-console
  if (process.env.N8N_DEBUG_LOG === '1') {
    console.log(`[n8n-internal] login ok in ${Date.now() - started}ms`);
  }

  await writeSession<CachedCookie>(SESSION_KEY, { cookie }, SESSION_TTL_MS);
  return cookie;
}

async function getCookie(): Promise<string> {
  const cached = await readSession<CachedCookie>(SESSION_KEY);
  if (cached?.payload?.cookie) return cached.payload.cookie;
  return performLogin();
}

export interface InternalRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Override per-request timeout in ms. */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Pass `true` for /rest/login to allow login without an existing cookie. */
  bootstrap?: boolean;
}

export async function internalRequest<T = unknown>(
  path: string,
  opts: InternalRequestOptions = {},
): Promise<T> {
  if (!isInternalApiConfigured()) {
    throw new N8nInternalError(
      'Internal API is not configured.',
      0,
      'Set N8N_INTERNAL_EMAIL and N8N_INTERNAL_PASSWORD in .env.',
    );
  }
  const env = getEnv();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${env.N8N_BASE_URL}/rest${cleanPath}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const method = opts.method ?? 'GET';
  const timeout = opts.timeoutMs ?? env.N8N_TIMEOUT_MS;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeout);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort('caller-aborted');
    else opts.signal.addEventListener('abort', () => controller.abort('caller-aborted'));
  }

  const send = async (cookie: string | undefined, retry: boolean): Promise<Response> => {
    if (cookie) headers.Cookie = cookie;
    return fetchWithDispatcher(url.toString(), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    }).then(async (r) => {
      if (r.status === 401 && !retry) {
        // Cookie might be stale or revoked — wipe and re-login.
        await clearSession(SESSION_KEY);
        const fresh = await performLogin();
        headers.Cookie = fresh;
        return send(fresh, true);
      }
      return r;
    });
  };

  try {
    const cookie = await getCookie();
    const res = await send(cookie, false);
    clearTimeout(timeoutId);
    return parseResponse<T>(res, method, path);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof N8nInternalError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new N8nInternalError(
      `Network error talking to n8n internal API at ${env.N8N_BASE_URL}: ${msg}`,
      0,
      isHttpBaseUrl() ? 'Make sure N8N_BASE_URL is reachable.' : undefined,
    );
  }
}

async function parseResponse<T>(res: Response, method: string, path: string): Promise<T> {
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => undefined) : await res.text();
  if (!res.ok) {
    let message = `n8n internal ${method} ${path} failed: ${res.status} ${res.statusText}`;
    if (isJson && payload && typeof payload === 'object') {
      const m = (payload as { message?: string }).message;
      if (m) message = `${message} — ${m}`;
    }
    throw new N8nInternalError(message, res.status, hintForStatus(res.status), payload);
  }
  return payload as T;
}

function hintForStatus(status: number): string | undefined {
  if (status === 401) return 'Session rejected by n8n. The service-account password may be wrong or user management is disabled.';
  if (status === 403) return 'The internal-API user does not have permission for this endpoint.';
  if (status === 404) return 'The internal endpoint does not exist in your n8n version. The internal REST API is version-dependent.';
  if (status === 502 || status === 503 || status === 504) return 'n8n is unreachable or unhealthy.';
  return undefined;
}

/** Lightweight health probe. Reports configuration + reachability without throwing. */
export async function probeInternalApi(): Promise<InternalStatus> {
  const env = safeGetEnv();
  const status: InternalStatus = {
    configured: !!env?.N8N_INTERNAL_EMAIL && !!env?.N8N_INTERNAL_PASSWORD,
    reachable: false,
    cached: false,
    baseUrl: env?.N8N_BASE_URL,
  };
  if (!status.configured) {
    status.error = 'Not configured. Set N8N_INTERNAL_EMAIL and N8N_INTERNAL_PASSWORD in .env.';
    return status;
  }
  const cached = await readSession<CachedCookie>(SESSION_KEY);
  status.cached = !!cached?.payload?.cookie;
  try {
    await internalRequest('/projects', { query: { limit: 1 } });
    status.reachable = true;
  } catch (e) {
    status.error = e instanceof Error ? e.message : String(e);
  }
  return status;
}

function safeGetEnv() {
  try {
    return getEnv();
  } catch {
    return undefined;
  }
}