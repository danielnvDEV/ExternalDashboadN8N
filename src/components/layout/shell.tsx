'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Capability } from '@/lib/capability';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { Breadcrumbs } from './page-header';

export function Shell({ children }: { children: React.ReactNode }) {
  const { data } = useQuery<{ ok: boolean; data?: Capability }>({
    queryKey: ['n8n-discover'],
    queryFn: async () => {
      const r = await fetch('/api/n8n/discover', { cache: 'no-store' });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Hydrate Capability shape from the proxy response
  const capability: Capability | null = React.useMemo(() => {
    if (!data?.data) return null;
    // The discover proxy returns the raw /discover payload; we need to normalize.
    const inner = (data.data as { data?: unknown }).data as
      | {
          scopes?: string[];
          resources?: Record<string, { endpoints?: Array<{ method: string; path: string }> }>;
        }
      | undefined;
    if (!inner) return null;
    const scopes = new Set(inner.scopes ?? []);
    const resources = new Set(Object.keys(inner.resources ?? {}));
    const endpoints = new Map<string, { method: string; path: string }>();
    for (const info of Object.values(inner.resources ?? {})) {
      for (const ep of info.endpoints ?? []) {
        endpoints.set(`${ep.method.toUpperCase()} ${ep.path}`, { method: ep.method.toUpperCase(), path: ep.path });
      }
    }
    return { scopes, resources, endpoints };
  }, [data]);

  return (
    <div className="flex min-h-screen">
      <Sidebar capability={capability} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 px-4 md:px-8 py-6 max-w-screen-2xl w-full mx-auto">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
