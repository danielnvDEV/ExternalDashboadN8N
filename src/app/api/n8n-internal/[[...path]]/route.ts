import { NextRequest, NextResponse } from 'next/server';
import { internalRequest, isInternalApiConfigured, N8nInternalError } from '@/lib/internal-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type AllowedMethod = (typeof ALLOWED_METHODS)[number];

const SEGMENT_RE = /^[A-Za-z0-9_\-.~]+$/;

function isPathSafe(segments: string[]): boolean {
  if (segments.length === 0) return false;
  for (const s of segments) {
    if (!s || s.length > 128) return false;
    if (!SEGMENT_RE.test(s)) return false;
    if (s === '.' || s === '..') return false;
  }
  return true;
}

async function handle(req: NextRequest, ctx: { params: { path?: string[] } }) {
  if (!isInternalApiConfigured()) {
    return NextResponse.json(
      {
        error: 'not_configured',
        message: 'Internal API is not configured on the server.',
        hint: 'Set N8N_INTERNAL_EMAIL and N8N_INTERNAL_PASSWORD in the server .env file. See .env.example.',
      },
      { status: 503 },
    );
  }

  const segments = ctx.params.path ?? [];
  if (!isPathSafe(segments)) {
    return NextResponse.json(
      { error: 'bad_request', message: 'Invalid path' },
      { status: 400 },
    );
  }
  const path = '/' + segments.join('/');

  const url = new URL(req.url);
  const query: Record<string, string | number | boolean> = {};
  url.searchParams.forEach((v, k) => {
    if (k.length > 128) return;
    if (v === 'true') query[k] = true;
    else if (v === 'false') query[k] = false;
    else if (/^-?\d+(?:\.\d+)?$/.test(v)) query[k] = Number(v);
    else query[k] = v;
  });

  const method = req.method as AllowedMethod;
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json(
      { error: 'method_not_allowed' },
      { status: 405, headers: { Allow: ALLOWED_METHODS.join(', ') } },
    );
  }

  let body: unknown;
  if (method !== 'GET' && method !== 'DELETE') {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: 'bad_request', message: 'Invalid JSON body' },
          { status: 400 },
        );
      }
    }
  }

  try {
    const result = await internalRequest<unknown>(path, { method, query, body });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  if (err instanceof N8nInternalError) {
    const status = err.status === 0 ? 502 : err.status;
    return NextResponse.json(
      {
        error: 'n8n_internal_error',
        message: err.message,
        status: err.status,
        hint: err.hint,
      },
      { status },
    );
  }
  return NextResponse.json({ error: 'internal' }, { status: 500 });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;