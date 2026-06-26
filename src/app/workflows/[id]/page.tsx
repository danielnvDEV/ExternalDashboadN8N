'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Box,
  Code,
  Copy,
  ExternalLink,
  History,
  Pause,
  Pencil,
  Play,
  Power,
  PowerOff,
  Save,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CodeViewer } from '@/components/code-viewer';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DownloadJsonButton } from '@/components/workflow/download-json-button';
import { absoluteTime, relativeTime } from '@/lib/format';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type { Execution, Tag, TagAssignment, Workflow, WorkflowNode } from '@/lib/types';

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id;

  const wf = useQuery<Workflow>({
    queryKey: ['n8n-workflow', id],
    queryFn: () => apiFetch(`workflows/${id}`, { query: { excludePinnedData: true } }),
  });

  const tags = useQuery({
    queryKey: ['n8n-workflow-tags', id],
    queryFn: () => apiFetch<TagAssignment>(`workflows/${id}/tags`),
  });

  const executions = useQuery({
    queryKey: ['n8n-workflow-execs', id],
    queryFn: () =>
      apiFetch<{ data: Execution[]; nextCursor: string | null }>(`executions`, {
        query: { workflowId: id, limit: 20, includeData: false },
      }),
    refetchInterval: 15_000,
  });

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorValue, setEditorValue] = React.useState('');
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferProjectId, setTransferProjectId] = React.useState('');

  React.useEffect(() => {
    if (wf.data && editorOpen) {
      setEditorValue(JSON.stringify(wf.data, null, 2));
    }
  }, [wf.data, editorOpen]);

  const onAction = async (action: 'activate' | 'deactivate' | 'archive' | 'unarchive') => {
    try {
      await apiFetch(`workflows/${id}/${action}`, { method: 'POST' });
      wf.refetch();
      toast({ title: `${action} done`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Action failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onDelete = async () => {
    await apiFetch(`workflows/${id}`, { method: 'DELETE' });
    toast({ title: 'Deleted', variant: 'success' });
    router.push('/workflows');
  };

  const onSave = async () => {
    try {
      const parsed = JSON.parse(editorValue) as Workflow;
      const body = {
        name: parsed.name,
        nodes: parsed.nodes,
        connections: parsed.connections,
        settings: parsed.settings,
        versionId: parsed.versionId,
      };
      await apiFetch(`workflows/${id}`, { method: 'PUT', body });
      wf.refetch();
      setEditorOpen(false);
      toast({ title: 'Saved', variant: 'success' });
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onTransfer = async () => {
    if (!transferProjectId) return;
    try {
      await apiFetch(`workflows/${id}/transfer`, {
        method: 'PUT',
        body: { destinationProjectId: transferProjectId },
      });
      wf.refetch();
      setTransferOpen(false);
      toast({ title: 'Transferred', variant: 'success' });
    } catch (e) {
      toast({ title: 'Transfer failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  if (wf.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (wf.isError) return <PageError error={wf.error} />;
  if (!wf.data) return null;

  const w = wf.data;

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/workflows')} className="mb-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to workflows
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight truncate">{w.name || 'Unnamed'}</h1>
              {w.active ? (
                <Badge variant="success">
                  <Power className="h-3 w-3 mr-1" /> Active
                </Badge>
              ) : (
                <Badge variant="muted">Inactive</Badge>
              )}
              {w.isArchived && <Badge variant="muted">Archived</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{w.id}</p>
            <p className="text-xs text-muted-foreground">
              Created {relativeTime(w.createdAt)} · Updated {relativeTime(w.updatedAt)}
              {w.versionId && <> · v{w.versionId.slice(0, 8)}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {!w.active ? (
              <Button size="sm" onClick={() => onAction('activate')}>
                <Play className="h-3.5 w-3.5 mr-1" /> Activate
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onAction('deactivate')}>
                <Pause className="h-3.5 w-3.5 mr-1" /> Deactivate
              </Button>
            )}
            {!w.isArchived ? (
              <Button size="sm" variant="outline" onClick={() => onAction('archive')}>
                <Archive className="h-3.5 w-3.5 mr-1" /> Archive
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onAction('unarchive')}>
                <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Unarchive
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit JSON
            </Button>
            <DownloadJsonButton workflowId={w.id} workflowName={w.name ?? ''} />
            <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Transfer
            </Button>
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              }
              title={`Delete "${w.name || 'Unnamed'}"?`}
              description="This action is permanent."
              confirmText="Delete forever"
              onConfirm={onDelete}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Nodes" value={w.nodes?.length ?? 0} />
        <Stat label="Connections" value={Object.keys(w.connections ?? {}).length} />
        <Stat label="Triggers" value={w.triggerCount ?? '-'} />
        <Stat label="Active version" value={w.activeVersion?.id ? w.activeVersion.id.slice(0, 8) : '-'} />
      </div>

      <Tabs defaultValue="nodes">
        <TabsList>
          <TabsTrigger value="nodes">
            <Box className="h-3.5 w-3.5 mr-1" /> Nodes ({w.nodes?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Code className="h-3.5 w-3.5 mr-1" /> Settings
          </TabsTrigger>
          <TabsTrigger value="tags">
            <TagIcon className="h-3.5 w-3.5 mr-1" /> Tags ({tags.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="executions">
            <Activity className="h-3.5 w-3.5 mr-1" /> Executions
          </TabsTrigger>
          <TabsTrigger value="json">
            <Code className="h-3.5 w-3.5 mr-1" /> Raw JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nodes">
          <Card>
            <CardContent className="pt-6">
              {w.nodes && w.nodes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {w.nodes.map((n: WorkflowNode) => (
                    <div key={n.id} className="rounded-md border bg-muted/20 p-2 text-xs">
                      <div className="font-mono font-semibold truncate">{n.name}</div>
                      <div className="text-muted-foreground truncate">{n.type}</div>
                      {n.disabled && <Badge variant="muted" className="text-[10px] mt-1">disabled</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No nodes.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardContent className="pt-6">
              <CodeViewer data={w.settings ?? {}} maxHeight="500px" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags">
          <Card>
            <CardContent className="pt-6">
              {tags.isLoading ? (
                <Skeleton className="h-12" />
              ) : !tags.data?.length ? (
                <p className="text-sm text-muted-foreground">No tags assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.data.map((t: { id: string; name?: string }) => (
                    <Badge key={t.id} variant="secondary">{t.name ?? t.id.slice(0, 8)}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions">
          <Card>
            <CardContent className="pt-6">
              {executions.isLoading ? (
                <Skeleton className="h-32" />
              ) : !executions.data?.data.length ? (
                <p className="text-sm text-muted-foreground">No executions yet.</p>
              ) : (
                <div className="space-y-1">
                  {executions.data.data.map((e) => (
                    <a
                      key={e.id}
                      href={`/executions/${e.id}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-accent/50 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant={e.status === 'success' ? 'success' : e.status === 'error' || e.status === 'crashed' ? 'destructive' : 'secondary'} className="text-[10px] uppercase font-mono w-16 justify-center">
                          {e.status}
                        </Badge>
                        <span className="font-mono text-xs truncate">{e.id}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{e.mode}</span>
                        <span>{relativeTime(e.startedAt)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardContent className="pt-6">
              <CodeViewer data={w} maxHeight="700px" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit JSON Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit workflow JSON</DialogTitle>
            <DialogDescription>
              Send a PUT request to <code>/workflows/{id}</code>. The <code>versionId</code> is used for optimistic locking.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editorValue}
            onChange={(e) => setEditorValue(e.target.value)}
            className="font-mono text-xs h-[60vh]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
            <Button onClick={onSave}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer to project</DialogTitle>
            <DialogDescription>
              Move this workflow to a different project (Enterprise/RBAC only).
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Destination project ID"
            value={transferProjectId}
            onChange={(e) => setTransferProjectId(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onTransfer} disabled={!transferProjectId}>
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// helpers
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}
