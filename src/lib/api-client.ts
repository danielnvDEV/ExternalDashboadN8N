'use client';

import { useQuery } from '@tanstack/react-query';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly hint?: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface JsonOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildQuery(query?: JsonOptions['query']): string {
  if (!query) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: JsonOptions = {},
): Promise<T> {
  const url = `/api/n8n/${path.replace(/^\//, '')}${buildQuery(opts.query)}`;
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => undefined);
  if (!res.ok) {
    const e = json as { error?: string; message?: string; hint?: string; status?: number; body?: unknown } | undefined;
    throw new ApiError(
      e?.message ?? `Request failed: ${res.status}`,
      e?.status ?? res.status,
      e?.hint,
      e?.body,
    );
  }
  return json as T;
}

export function useN8nQuery<T = unknown>(
  key: unknown[],
  path: string,
  query?: JsonOptions['query'],
  options?: { refetchInterval?: number; enabled?: boolean },
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: ({ signal }) => apiFetch<T>(path, { query, signal }),
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
    staleTime: 10_000,
  });
}
