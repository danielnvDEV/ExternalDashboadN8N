import { NextRequest, NextResponse } from 'next/server';
import { n8nRequest, N8nError } from '@/lib/n8n-client';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type AllowedMethod = (typeof ALLOWED_METHODS)[number];

// Only path segments matching this are forwarded to n8n. This blocks
// path traversal (".."), encoded slashes, NULs, and anything unusual.
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
  try {
    getEnv();
  } catch (e) {
    return NextResponse.json(
      { error: 'misconfigured', message: (e as Error).message },
      { status: 500 },
    );
  }

  const pathSegments = ctx.params.path ?? [];
  if (!isPathSafe(pathSegments)) {
    return NextResponse.json(
      { error: 'bad_request', message: 'Invalid path' },
      { status: 400 },
    );
  }
  const path = '/' + pathSegments.join('/');

  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (k.length > 128) return;
    query[k] = v;
  });

  const method = req.method as AllowedMethod;
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json(
      { error: 'method_not_allowed' },
      { status: 405, headers: { Allow: ALLOWED_METHODS.join(', ') } },
    );
  }

  let body: unknown;
  const contentType = req.headers.get('content-type') ?? '';
  if (method !== 'GET' && method !== 'DELETE') {
    if (contentType.includes('multipart/form-data')) {
      try {
        const form = await req.formData();
        const result = await n8nRequest<unknown>(path, {
          method,
          query,
          formData: form,
        });
        return NextResponse.json(result);
      } catch (err) {
        return errorResponse(err);
      }
    } else if (contentType.includes('application/json')) {
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
    const result = await n8nRequest<unknown>(path, {
      method,
      query,
      body,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  if (err instanceof N8nError) {
    return NextResponse.json(
      {
        error: 'n8n_error',
        message: err.message,
        status: err.status,
        hint: err.hint,
      },
      { status: err.status === 0 ? 502 : err.status },
    );
  }
  return NextResponse.json(
    { error: 'internal' },
    { status: 500 },
  );
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
