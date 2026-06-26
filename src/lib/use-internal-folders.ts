'use client';

import * as React from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { Folder, Project, WorkflowInternal } from '@/lib/types';
import { resolveWorkflowFolderId } from '@/lib/types';
import { buildFolderPathMap, type FolderPathMap } from './folder-paths';
import { isInternalApiEnabled } from './feature-flags';

interface InternalStatus {
  configured: boolean;
  reachable: boolean;
  cached: boolean;
}

interface FolderInfo {
  id: string;
  name: string;
  path: string;
}

export interface InternalFolderData {
  /** workflowId → folderId (null when workflow has no folder). */
  workflowFolderId: Map<string, string | null>;
  /** folderId → { name, path }. */
  folderInfo: Map<string, FolderInfo>;
  /** Folder tree built from the flat folder list. */
  pathMap: FolderPathMap;
  /** folderId → count of workflows in this folder AND all its descendants. */
  folderTotalCount: Map<string, number>;
  /** Number of workflows without any folder. */
  unfolderedCount: number;
  /** Total workflows across all folders + unfoldered. */
  totalCount: number;
  /** True while any of the underlying queries are still loading. */
  isLoading: boolean;
  /** True if internal API is reachable AND returned data. */
  available: boolean;
  /** Error from the status probe, if any. */
  error: string | null;
}

async function internalGet<T>(path: string, query?: Record<string, string | number>): Promise<T> {
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const res = await fetch(`/api/n8n-internal/${path.replace(/^\//, '')}${qs}`, { cache: 'no-store' });
  const json = await res.json().catch(() => undefined);
  if (!res.ok) {
    const err = new Error(json?.message ?? `HTTP ${res.status}`) as Error & { status?: number; configured?: boolean };
    err.status = json?.status ?? res.status;
    err.configured = json?.error === 'not_configured';
    throw err;
  }
  return json as T;
}

/**
 * Fetch workflow→folder and folderId→{name,path} maps from n8n's internal
 * REST API. Returns empty maps (and `available: false`) when the internal
 * API is disabled or unreachable, so callers can render a graceful fallback.
 */
export function useInternalFolderData(): InternalFolderData {
  const enabled = isInternalApiEnabled();

  const statusQ = useQuery<InternalStatus>({
    queryKey: ['n8n-int-status'],
    queryFn: () => internalGet<InternalStatus>('status'),
    enabled,
    retry: false,
    staleTime: 60_000,
  });

  const reachable = !!statusQ.data?.reachable;

  const projectsQ = useQuery<{ data: Project[] }>({
    queryKey: ['n8n-int-projects-folders'],
    queryFn: () => internalGet<{ data: Project[] }>('projects', { limit: 100 }),
    enabled: enabled && reachable,
    retry: false,
    staleTime: 60_000,
  });

  const workflowsQ = useQuery<{ count: number; data: WorkflowInternal[] }>({
    queryKey: ['n8n-int-workflows-folders'],
    queryFn: () => internalGet<{ count: number; data: WorkflowInternal[] }>('workflows', { limit: 250 }),
    enabled: enabled && reachable,
    retry: false,
    staleTime: 60_000,
  });

  const folderQueries = useQueries({
    queries: (projectsQ.data?.data ?? []).map((p) => ({
      queryKey: ['n8n-int-folders-of', p.id],
      queryFn: () =>
        internalGet<{ count: number; data: Folder[] }>(`projects/${p.id}/folders`, { take: 100 }),
      enabled: enabled && reachable,
      retry: false,
      staleTime: 60_000,
    })),
  });

  const allFolders = React.useMemo<Folder[]>(() => {
    const out: Folder[] = [];
    for (const q of folderQueries) {
      if (q.data?.data) out.push(...q.data.data);
    }
    return out;
  }, [folderQueries]);

  return React.useMemo<InternalFolderData>(() => {
    const workflowFolderId = new Map<string, string | null>();
    for (const wf of workflowsQ.data?.data ?? []) {
      workflowFolderId.set(wf.id, resolveWorkflowFolderId(wf));
    }
    const folderInfo = new Map<string, FolderInfo>();
    const pathMap = buildFolderPathMap(allFolders);
    for (const f of allFolders) {
      folderInfo.set(f.id, {
        id: f.id,
        name: f.name,
        path: pathMap.pathById.get(f.id) ?? f.name,
      });
    }

    // Recursive workflow counts per folder (includes descendants).
    const directByFolder = new Map<string, number>();
    let unfolderedCount = 0;
    let totalCount = 0;
    for (const fid of workflowFolderId.values()) {
      totalCount++;
      if (fid == null) {
        unfolderedCount++;
      } else {
        directByFolder.set(fid, (directByFolder.get(fid) ?? 0) + 1);
      }
    }
    const folderTotalCount = new Map<string, number>();
    const sumRecursive = (id: string, memo: Map<string, number>): number => {
      const cached = memo.get(id);
      if (cached !== undefined) return cached;
      const direct = directByFolder.get(id) ?? 0;
      const children = pathMap.childrenById.get(id) ?? [];
      let total = direct;
      for (const c of children) total += sumRecursive(c.id, memo);
      memo.set(id, total);
      return total;
    };
    for (const root of pathMap.roots) sumRecursive(root.id, folderTotalCount);

    const isLoading =
      statusQ.isFetching ||
      projectsQ.isFetching ||
      workflowsQ.isFetching ||
      folderQueries.some((q) => q.isFetching);
    const available = !!statusQ.data?.reachable && !!workflowsQ.data && !!projectsQ.data;
    const error =
      (statusQ.error as Error | null)?.message ??
      (projectsQ.error as Error | null)?.message ??
      (workflowsQ.error as Error | null)?.message ??
      null;
    return {
      workflowFolderId,
      folderInfo,
      pathMap,
      folderTotalCount,
      unfolderedCount,
      totalCount,
      isLoading,
      available,
      error,
    };
  }, [
    statusQ.data,
    statusQ.isFetching,
    statusQ.error,
    projectsQ.data,
    projectsQ.isFetching,
    projectsQ.error,
    workflowsQ.data,
    workflowsQ.isFetching,
    workflowsQ.error,
    folderQueries,
    allFolders,
  ]);
}