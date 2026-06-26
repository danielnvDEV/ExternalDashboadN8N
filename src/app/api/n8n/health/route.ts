import { NextResponse } from 'next/server';
import { n8nRequest } from '@/lib/n8n-client';
import { getEnv, isHttpBaseUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  let env;
  try {
    env = getEnv();
  } catch (e) {
    return NextResponse.json(
      { ok: false, status: 'misconfigured', message: (e as Error).message },
      { status: 500 },
    );
  }

  const started = Date.now();
  try {
    // /discover is unauthenticated-friendly and light; perfect for healthcheck.
    await n8nRequest('/discover');
    return NextResponse.json({
      ok: true,
      status: 'up',
      baseUrl: env.N8N_BASE_URL,
      insecure: isHttpBaseUrl(),
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        status: 'down',
        baseUrl: env.N8N_BASE_URL,
        insecure: isHttpBaseUrl(),
        latencyMs: Date.now() - started,
        message: (e as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
