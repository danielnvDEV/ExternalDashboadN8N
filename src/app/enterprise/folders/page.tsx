'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, KeyRound, RefreshCw, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/ui/toaster';
import { relativeTime } from '@/lib/format';
import { buildFolderPathMap } from '@/lib/folder-paths';
import { isInternalApiEnabled } from '@/lib/feature-flags';
import { EnterpriseGuard } from '@/components/enterprise-guard';
import type { Folder as FolderT, Project, WorkflowInternal } from '@/lib/types';
import { resolveWorkflowFolderId } from '@/lib/types';

interface InternalApiError extends Error {
  status?: number;
  hint?: string;
  configured?: boolean;
}

async function internalFetch<T>(path: string, query?: Record<string, string | number>): Promise<T> {
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
    const err = new Error(json?.message ?? `HTTP ${res.status}`) as InternalApiError;
    err.status = json?.status ?? res.status;
    err.hint = json?.hint;
    err.configured = json?.error === 'not_configured';
    throw err;
  }
  return json as T;
}

export default function FoldersPage() {
  if (!isInternalApiEnabled()) {
    return <EnterpriseGuard><FoldersContent /></EnterpriseGuard>;
  }
  return <FoldersContent />;
}

function FoldersContent() {
  const { toast } = useToast();
  const [projectId, setProjectId] = React.useState('');

  const projectsQ = useQuery<{ data: Project[] }>({
    queryKey: ['n8n-int-projects'],
    queryFn: () => internalFetch<{ data: Project[] }>('projects', { limit: 100 }),
  });

  React.useEffect(() => {
    if (!projectId && projectsQ.data?.data[0]) {
      setProjectId(projectsQ.data.data[0].id);
    }
  }, [projectsQ.data, projectId]);

  const foldersQ = useQuery<{ count: number; data: FolderT[] }>({
    queryKey: ['n8n-int-folders', projectId],
    queryFn: () => internalFetch<{ count: number; data: FolderT[] }>(`projects/${projectId}/folders`, { take: 100 }),
    enabled: !!projectId,
  });

  const workflowsQ = useQuery<{ count: number; data: WorkflowInternal[] }>({
    queryKey: ['n8n-int-project-workflows', projectId],
    queryFn: () =>
      internalFetch<{ count: number; data: WorkflowInternal[] }>('workflows', {
        projectId,
        limit: 250,
      }),
    enabled: !!projectId,
  });

  const pathMap = React.useMemo(() => buildFolderPathMap(foldersQ.data?.data ?? []), [foldersQ.data]);

  const grouped = React.useMemo(() => {
    const byFolder = new Map<string, WorkflowInternal[]>();
    const unfoldered: WorkflowInternal[] = [];
    for (const wf of workflowsQ.data?.data ?? []) {
      const fid = resolveWorkflowFolderId(wf);
      if (!fid) {
        unfoldered.push(wf);
      } else {
        const arr = byFolder.get(fid) ?? [];
        arr.push(wf);
        byFolder.set(fid, arr);
      }
    }
    return { byFolder, unfoldered };
  }, [workflowsQ.data]);

  const onDeleteFolder = async (f: FolderT) => {
    const transfer = window.prompt(
      `Folder "${f.name}" has ${f.totalWorkflows ?? grouped.byFolder.get(f.id)?.length ?? '?'} workflow(s). Enter a destination folder ID to move them to (or cancel to abort):`,
    );
    if (transfer === null) return;
    try {
      const qs = transfer ? `?transferToFolderId=${encodeURIComponent(transfer)}` : '';
      await fetch(`/api/n8n-internal/projects/${projectId}/folders/${f.id}${qs}`, { method: 'DELETE' });
      foldersQ.refetch();
      workflowsQ.refetch();
      toast({ title: 'Folder deleted', variant: 'success' });
    } catch (e) {
      toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onRefreshAll = () => {
    foldersQ.refetch();
    workflowsQ.refetch();
  };

  const anyError = foldersQ.error as InternalApiError | null;
  const notConfigured = anyError?.configured;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Folder className="h-7 w-7" /> Folders
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Workflows grouped by folder. Powered by the n8n internal REST API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Choose project…" />
            </SelectTrigger>
            <SelectContent>
              {projectsQ.data?.data.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={onRefreshAll} aria-label="Refresh" disabled={!projectId}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {notConfigured && (
        <Card className="border-yellow-500/40 bg-yellow-500/10">
          <CardContent className="pt-6 flex items-start gap-2 text-sm">
            <KeyRound className="h-4 w-4 mt-0.5 text-yellow-700 dark:text-yellow-300" />
            <div>
              <p className="font-medium">Internal API not configured.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Set <code className="font-mono">N8N_INTERNAL_EMAIL</code> and{' '}
                <code className="font-mono">N8N_INTERNAL_PASSWORD</code> in the server <code>.env</code>{' '}
                file to enable folder-aware workflow listing. The public REST API does not expose which workflows live in each folder.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {anyError && !notConfigured && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive space-y-1">
            <p className="font-medium">{anyError.message}</p>
            {anyError.hint && <p className="text-xs text-muted-foreground">{anyError.hint}</p>}
          </CardContent>
        </Card>
      )}

      {!projectId ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Select a project to see its folders.</CardContent>
        </Card>
      ) : foldersQ.isLoading || workflowsQ.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <>
          {pathMap.roots.length === 0 && grouped.unfoldered.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground text-center py-12">
                <FolderPlus className="inline h-8 w-8 mb-2 opacity-50" />
                <p>No folders or workflows in this project.</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {pathMap.roots.map((root) => (
              <FolderNode
                key={root.id}
                folder={root}
                depth={0}
                pathMap={pathMap}
                workflows={grouped.byFolder}
                onDelete={onDeleteFolder}
                defaultExpanded
              />
            ))}
          </div>

          <UnfolderedSection workflows={grouped.unfoldered} />
        </>
      )}
    </div>
  );
}

function FolderNode({
  folder,
  depth,
  pathMap,
  workflows,
  onDelete,
  defaultExpanded = false,
}: {
  folder: FolderT;
  depth: number;
  pathMap: ReturnType<typeof buildFolderPathMap>;
  workflows: Map<string, WorkflowInternal[]>;
  onDelete: (f: FolderT) => void;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultExpanded);
  const children = pathMap.childrenById.get(folder.id) ?? [];
  const list = workflows.get(folder.id) ?? [];
  const path = pathMap.pathById.get(folder.id) ?? folder.name;
  const hasContent = list.length > 0 || children.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-0.5 inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {hasContent ? (
              open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <span className="block w-2 h-2 rounded-full bg-muted-foreground/30" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {open && hasContent ? (
                <FolderOpen className="h-4 w-4 text-primary" />
              ) : (
                <Folder className="h-4 w-4 text-muted-foreground" />
              )}
              <CardTitle className="text-sm font-medium">{folder.name}</CardTitle>
              <Badge variant="muted" className="text-[10px]">{path}</Badge>
              <Badge variant="secondary" className="text-[10px]">
                <WorkflowIcon className="h-2.5 w-2.5 mr-0.5" />
                {list.length}
              </Badge>
              {children.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {children.length} sub
                </Badge>
              )}
            </div>
            <CardDescription className="text-[11px]">
              Updated {relativeTime(folder.updatedAt)}
            </CardDescription>
          </div>
          <ConfirmDialog
            trigger={
              <Button size="icon" variant="ghost" aria-label="Delete folder">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            }
            title={`Delete folder "${folder.name}"?`}
            description="You will be prompted to move its workflows to another folder before deletion."
            confirmText="Delete"
            onConfirm={() => onDelete(folder)}
          />
        </div>
      </CardHeader>
      {open && hasContent && (
        <CardContent className="pt-0 pl-12 space-y-2">
          {list.length > 0 && (
            <ul className="space-y-1">
              {list.map((wf) => (
                <li key={wf.id}>
                  <a
                    href={`/workflows/${wf.id}`}
                    className="flex items-center justify-between rounded-md border px-2 py-1.5 hover:bg-accent/50 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <WorkflowIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{wf.name || '(unnamed)'}</span>
                      {wf.active ? (
                        <Badge variant="success" className="text-[10px]">active</Badge>
                      ) : (
                        <Badge variant="muted" className="text-[10px]">inactive</Badge>
                      )}
                      {wf.isArchived && <Badge variant="muted" className="text-[10px]">archived</Badge>}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {wf.id.slice(0, 8)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {children.length > 0 && (
            <div className="space-y-2">
              {children.map((child) => (
                <FolderNode
                  key={child.id}
                  folder={child}
                  depth={depth + 1}
                  pathMap={pathMap}
                  workflows={workflows}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function UnfolderedSection({ workflows }: { workflows: WorkflowInternal[] }) {
  if (workflows.length === 0) return null;
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground" />
          Sin carpeta
          <Badge variant="secondary" className="text-[10px]">
            <WorkflowIcon className="h-2.5 w-2.5 mr-0.5" />
            {workflows.length}
          </Badge>
        </CardTitle>
        <CardDescription className="text-[11px]">Workflows que no están dentro de ninguna carpeta.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-1">
          {workflows.map((wf) => (
            <li key={wf.id}>
              <a
                href={`/workflows/${wf.id}`}
                className="flex items-center justify-between rounded-md border px-2 py-1.5 hover:bg-accent/50 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <WorkflowIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{wf.name || '(unnamed)'}</span>
                  {wf.active ? (
                    <Badge variant="success" className="text-[10px]">active</Badge>
                  ) : (
                    <Badge variant="muted" className="text-[10px]">inactive</Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 font-mono">{wf.id.slice(0, 8)}</span>
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}