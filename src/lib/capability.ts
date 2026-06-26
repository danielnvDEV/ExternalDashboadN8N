import { n8nRequest } from './n8n-client';
import type { DiscoverResponse } from './types';

export interface Capability {
  resources: Set<string>;
  scopes: Set<string>;
  endpoints: Map<string, { method: string; path: string }>; // key: "METHOD path"
}

const empty: Capability = {
  resources: new Set(),
  scopes: new Set(),
  endpoints: new Map(),
};

let cache: { data: Capability; fetchedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000; // 5 min

export async function getCapabilities(): Promise<Capability> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.data;
  try {
    const res = await n8nRequest<DiscoverResponse>('/discover', {
      query: { include: 'schemas' },
    });
    const data = res?.data;
    const resources = new Set(Object.keys(data?.resources ?? {}));
    const scopes = new Set(data?.scopes ?? []);
    const endpoints = new Map<string, { method: string; path: string }>();
    for (const [resource, info] of Object.entries(data?.resources ?? {})) {
      for (const ep of info.endpoints ?? []) {
        endpoints.set(`${ep.method.toUpperCase()} ${ep.path}`, {
          method: ep.method.toUpperCase(),
          path: ep.path,
        });
        void resource;
      }
    }
    cache = { data: { resources, scopes, endpoints }, fetchedAt: Date.now() };
    return cache.data;
  } catch {
    return empty;
  }
}

export function invalidateCapabilities() {
  cache = null;
}

export function can(
  cap: Capability,
  predicate: { resource?: string; scope?: string; method?: string; path?: string },
): boolean {
  if (predicate.resource && !cap.resources.has(predicate.resource)) return false;
  if (predicate.scope && !cap.scopes.has(predicate.scope)) return false;
  if (predicate.method && predicate.path) {
    if (!cap.endpoints.has(`${predicate.method.toUpperCase()} ${predicate.path}`)) return false;
  }
  return true;
}
