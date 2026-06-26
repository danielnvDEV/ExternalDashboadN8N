'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Filter,
  Loader2,
  Pause,
  Search,
  Square,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExecutionStatusBadge } from '@/components/status-badge';
import { CursorPagination, useCursorPagination } from '@/components/data-table/pagination-cursor';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { formatDuration, relativeTime, truncate } from '@/lib/format';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type { Execution, ExecutionStatus, PaginatedResponse, Workflow } from '@/lib/types';

const ALL_STATUSES: ExecutionStatus[] = [
  'canceled',
  'crashed',
  'error',
  'new',
  'running',
  'success',
  'unknown',
  'waiting',
];

export default function ExecutionsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const [workflowId, setWorkflowId] = React.useState(sp.get('workflowId') ?? '');
  const [statusFilter, setStatusFilter] = React.useState<string>(sp.get('status') ?? '');
  const [includeData, setIncludeData] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkStatuses, setBulkStatuses] = React.useState<string[]>(['running', 'waiting']);
  const [bulkSince, setBulkSince] = React.useState('');

  const params: Record<string, unknown> = { limit: 100, includeData: false };
  if (workflowId) params.workflowId = workflowId;
  if (statusFilter) params.status = statusFilter;

  const q = useCursorPagination<Execution>('executions', params, {
    queryKey: [workflowId, statusFilter],
    enabled: !bulkOpen,
  });

  const liveQ = useQuery({
    queryKey: ['n8n-exec-live-count'],
    queryFn: () =>
      apiFetch<{ data: Execution[]; nextCursor: string | null }>('executions', {
        query: { status: 'running', limit: 1, includeData: false },
      }),
    refetchInterval: 8_000,
  });

  const workflowsQ = useQuery<PaginatedResponse<Workflow>>({
    queryKey: ['n8n-exec-wfs'],
    queryFn: () => apiFetch('workflows', { query: { limit: 250 } }),
    staleTime: 60_000,
  });

  const onBulkStop = async () => {
    try {
      const result = await apiFetch<{ stopped: number }>('executions/stop', {
        method: 'POST',
        body: {
          status: bulkStatuses,
          ...(workflowId ? { workflowId } : {}),
          ...(bulkSince ? { startedAfter: new Date(bulkSince).toISOString() } : {}),
        },
      });
      toast({
        title: 'Bulk stop complete',
        description: `Stopped ${result.stopped} execution${result.stopped === 1 ? '' : 's'}`,
        variant: 'success',
      });
      setBulkOpen(false);
      q.refetch();
    } catch (e) {
      toast({ title: 'Bulk stop failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onStop = async (id: string) => {
    try {
      await apiFetch(`executions/${id}/stop`, { method: 'POST' });
      q.refetch();
      toast({ title: 'Stop signal sent', variant: 'success' });
    } catch (e) {
      toast({ title: 'Stop failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Executions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {q.data.length} execution{q.data.length === 1 ? '' : 's'} on this page
            {liveQ.data && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                {liveQ.data.data.length} running
              </span>
            )}
          </p>
        </div>
        <Button variant="destructive" onClick={() => setBulkOpen(true)}>
          <Square className="h-4 w-4 mr-1" /> Bulk stop
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Workflow ID…"
                value={workflowId}
                onChange={(e) => setWorkflowId(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={includeData} onCheckedChange={(v) => setIncludeData(!!v)} />
              Include data (slow)
            </label>
            <Button variant="ghost" size="sm" onClick={() => { setWorkflowId(''); setStatusFilter(''); q.first(); }}>
              <Filter className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {q.isError ? (
            <PageError error={q.error} />
          ) : q.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : q.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No executions match your filters.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left p-2 font-medium w-24">Status</th>
                    <th className="text-left p-2 font-medium">ID / Workflow</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell w-24">Mode</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell w-24">Duration</th>
                    <th className="text-left p-2 font-medium hidden lg:table-cell w-40">Started</th>
                    <th className="w-8 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((e) => {
                    const wf = workflowsQ.data?.data.find((w) => w.id === e.workflowId);
                    const dur =
                      e.startedAt && e.stoppedAt
                        ? new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime()
                        : e.startedAt
                          ? Date.now() - new Date(e.startedAt).getTime()
                          : null;
                    const isLive = e.status === 'running' || e.status === 'waiting';
                    return (
                      <tr key={e.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-2">
                          <ExecutionStatusBadge status={e.status} />
                        </td>
                        <td className="p-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => router.push(`/executions/${e.id}`)}
                            className="text-left hover:underline w-full"
                          >
                            <div className="font-mono text-xs truncate">{truncate(e.id, 28)}</div>
                            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              <WorkflowIcon className="h-3 w-3" />
                              {wf ? truncate(wf.name, 40) : truncate(e.workflowId, 30)}
                            </div>
                          </button>
                        </td>
                        <td className="p-2 hidden md:table-cell text-xs text-muted-foreground">{e.mode}</td>
                        <td className="p-2 hidden sm:table-cell text-xs text-muted-foreground">
                          {dur !== null ? formatDuration(dur) : '-'}
                        </td>
                        <td className="p-2 hidden lg:table-cell text-xs text-muted-foreground">
                          {relativeTime(e.startedAt)}
                        </td>
                        <td className="p-2 text-right">
                          {isLive ? (
                            <Button size="sm" variant="outline" onClick={() => onStop(e.id)}>
                              <Pause className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Badge variant="muted" className="text-[10px]">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                              {e.finished ? 'done' : 'pending'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <CursorPagination
              page={q.page}
              canPrev={q.canPrev}
              canNext={q.canNext}
              onPrev={q.prev}
              onNext={q.next}
              onFirst={q.first}
              isLoading={q.isFetching}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="h-4 w-4 text-destructive" />
              Bulk stop executions
            </DialogTitle>
            <DialogDescription>
              Sends a stop signal to all executions matching the criteria. Use carefully.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Statuses (required)</p>
              <div className="flex flex-wrap gap-1.5">
                {(['running', 'waiting', 'queued'] as const).map((s) => (
                  <label key={s} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={bulkStatuses.includes(s)}
                      onCheckedChange={(c) => {
                        setBulkStatuses((prev) =>
                          c ? [...new Set([...prev, s])] : prev.filter((x) => x !== s),
                        );
                      }}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Workflow ID (optional)</p>
              <Input
                placeholder="Filter by workflow ID"
                value={workflowId}
                onChange={(e) => setWorkflowId(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Started after (optional)</p>
              <Input
                type="datetime-local"
                value={bulkSince}
                onChange={(e) => setBulkSince(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <ConfirmDialog
              trigger={<Button variant="destructive">Stop all matching</Button>}
              title={`Stop ${bulkStatuses.length} status${bulkStatuses.length === 1 ? '' : 'es'}?`}
              description="This will cancel all matching running executions."
              confirmText="Stop"
              onConfirm={onBulkStop}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
