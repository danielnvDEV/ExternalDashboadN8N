import { NextResponse } from 'next/server';
import { n8nRequest } from '@/lib/n8n-client';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    getEnv();
  } catch (e) {
    return NextResponse.json(
      { error: 'misconfigured', message: (e as Error).message },
      { status: 500 },
    );
  }
  try {
    const data = await n8nRequest<unknown>('/discover');
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: 'n8n_error', message: (e as Error).message },
      { status: 503 },
    );
  }
}
