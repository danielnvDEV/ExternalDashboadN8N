import { NextResponse } from 'next/server';
import { probeInternalApi } from '@/lib/internal-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const status = await probeInternalApi();
  return NextResponse.json(status, {
    status: status.reachable ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}