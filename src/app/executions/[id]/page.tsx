'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  Calendar,
  Code,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Square,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { CodeViewer } from '@/components/code-viewer';
import { ExecutionStatusBadge } from '@/components/status-badge';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { absoluteTime, formatDuration, relativeTime } from '@/lib/format';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type { Execution } from '@/lib/types';

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id;

  const [includeData, setIncludeData] = React.useState(true);
  const [loadWorkflow, setLoadWorkflow] = React.useState(false);

  const q = useQuery<Execution>({
    queryKey: ['n8n-exec', id, includeData],
    queryFn: () => apiFetch(`executions/${id}`, { query: { includeData } }),
    refetchInterval: (qry) => {
      const status = (qry.state.data as Execution | undefined)?.status;
      return status === 'running' || status === 'waiting' || status === 'new' ? 5_000 : false;
    },
  });

  const onRetry = async () => {
    try {
      const r = await apiFetch<unknown>(`executions/${id}/retry`, {
        method: 'POST',
        body: { loadWorkflow },
      });
      const newId = (r as { data?: { id?: string } } | undefined)?.data?.id;
      toast({
        title: 'Retried',
        description: newId ? `New execution: ${newId}` : 'Execution started',
        variant: 'success',
      });
      if (newId) router.push(`/executions/${newId}`);
    } catch (e) {
      toast({ title: 'Retry failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onStop = async () => {
    try {
      await apiFetch(`executions/${id}/stop`, { method: 'POST' });
      q.refetch();
      toast({ title: 'Stop signal sent', variant: 'success' });
    } catch (e) {
      toast({ title: 'Stop failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (q.isError) return <PageError error={q.error} />;
  if (!q.data) return null;
  const e = q.data;

  const dur =
    e.startedAt && e.stoppedAt
      ? new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime()
      : e.startedAt
        ? Date.now() - new Date(e.startedAt).getTime()
        : null;

  const isLive = e.status === 'running' || e.status === 'waiting' || e.status === 'new';

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/executions')} className="mb-2">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to executions
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Execution</h1>
            <ExecutionStatusBadge status={e.status} />
            {isLive && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{e.id}</p>
          <p className="text-xs text-muted-foreground">
            Mode: {e.mode} · Workflow:{' '}
            <a href={`/workflows/${e.workflowId}`} className="underline">{e.workflowId}</a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox checked={loadWorkflow} onCheckedChange={(v) => setLoadWorkflow(!!v)} />
            Load latest workflow
          </label>
          {isLive ? (
            <ConfirmDialog
              trigger={<Button size="sm" variant="destructive"><Square className="h-3.5 w-3.5 mr-1" /> Stop</Button>}
              title="Stop this execution?"
              description="A stop signal will be sent to the worker."
              confirmText="Stop"
              onConfirm={onStop}
            />
          ) : (
            <Button size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
            </Button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1">
            <Checkbox checked={includeData} onCheckedChange={(v) => setIncludeData(!!v)} />
            Include data
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Started" value={absoluteTime(e.startedAt)} sub={relativeTime(e.startedAt)} />
        <Stat label="Stopped" value={e.stoppedAt ? absoluteTime(e.stoppedAt) : '—'} sub={e.stoppedAt ? relativeTime(e.stoppedAt) : 'still running'} />
        <Stat label="Duration" value={dur !== null ? formatDuration(dur) : '—'} />
        <Stat label="Finished" value={e.finished ? 'Yes' : 'No'} />
      </div>

      <Tabs defaultValue="data">
        <TabsList>
          <TabsTrigger value="data">
            <Activity className="h-3.5 w-3.5 mr-1" /> Data
          </TabsTrigger>
          <TabsTrigger value="meta">
            <Code className="h-3.5 w-3.5 mr-1" /> Meta
          </TabsTrigger>
        </TabsList>
        <TabsContent value="data">
          <Card>
            <CardContent className="pt-6">
              {!includeData ? (
                <p className="text-sm text-muted-foreground">
                  Data is hidden. Toggle &quot;Include data&quot; above to fetch and view execution data.
                </p>
              ) : e.data === undefined || e.data === null ? (
                <p className="text-sm text-muted-foreground">No data returned by the API.</p>
              ) : (
                <CodeViewer data={e.data} maxHeight="600px" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="meta">
          <Card>
            <CardContent className="pt-6">
              <CodeViewer
                data={{
                  id: e.id,
                  workflowId: e.workflowId,
                  mode: e.mode,
                  status: e.status,
                  finished: e.finished,
                  startedAt: e.startedAt,
                  stoppedAt: e.stoppedAt,
                  retryOf: e.retryOf,
                  retrySuccessId: e.retrySuccessId,
                  waitTill: e.waitTill,
                  customData: e.customData,
                }}
                maxHeight="500px"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-mono mt-0.5 truncate">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
