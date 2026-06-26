'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, CheckCircle2, Loader2, Tag as TagIcon, Workflow, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatNumber, relativeTime } from '@/lib/format';
import { useToast } from '@/components/ui/toaster';
import type { DiscoverResponse, Execution, PaginatedResponse, Tag, Workflow as WorkflowT } from '@/lib/types';

interface Stats {
  workflows: { total: number; active: number };
  executions: { total: number; failed: number; running: number; waiting: number };
  tags: number;
  capabilities: DiscoverResponse | null;
}

async function fetchJson<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    usp.set(k, String(v));
  }
  const r = await fetch(`/api/n8n/${path}?${usp.toString()}`, { cache: 'no-store' });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const e = new Error(err.message ?? `Request failed: ${r.status}`) as Error & { status: number; hint?: string };
    e.status = r.status;
    e.hint = err.hint;
    throw e;
  }
  return r.json();
}

export default function HomePage() {
  const { toast } = useToast();

  const discover = useQuery<DiscoverResponse>({
    queryKey: ['n8n-discover-full'],
    queryFn: () => fetchJson<DiscoverResponse>('discover'),
    staleTime: 5 * 60 * 1000,
  });
  React.useEffect(() => {
    if (discover.error) {
      toast({
        title: 'Cannot reach n8n',
        description: (discover.error as Error).message ?? 'Check N8N_BASE_URL and N8N_API_KEY in .env',
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discover.error]);

  const workflows = useQuery<PaginatedResponse<WorkflowT>>({
    queryKey: ['n8n-workflows-stats'],
    queryFn: () => fetchJson('workflows', { limit: 250 }),
  });

  const failed = useQuery<PaginatedResponse<Execution>>({
    queryKey: ['n8n-exec-failed'],
    queryFn: () => fetchJson('executions', { status: 'error', limit: 100, includeData: false }),
  });

  const running = useQuery<PaginatedResponse<Execution>>({
    queryKey: ['n8n-exec-running'],
    queryFn: () => fetchJson('executions', { status: 'running', limit: 100, includeData: false }),
    refetchInterval: 10_000,
  });

  const waiting = useQuery<PaginatedResponse<Execution>>({
    queryKey: ['n8n-exec-waiting'],
    queryFn: () => fetchJson('executions', { status: 'waiting', limit: 100, includeData: false }),
    refetchInterval: 10_000,
  });

  const tagsQ = useQuery<PaginatedResponse<Tag>>({
    queryKey: ['n8n-tags-stats'],
    queryFn: () => fetchJson('tags', { limit: 100 }),
  });

  const activeCount = workflows.data?.data.filter((w: WorkflowT) => w.active).length ?? 0;
  const totalCount = workflows.data?.data.length ?? 0;
  const totalFull = workflows.data?.nextCursor ? '250+' : String(totalCount);

  const capabilities = discover.data?.data;
  const resources = capabilities?.resources;
  const scopes = capabilities?.scopes ?? [];

  const erroredResources = React.useMemo(() => {
    if (!resources) return [];
    return Object.keys(resources).filter((r) => {
      const endpoints = resources[r]?.endpoints;
      return Array.isArray(endpoints) && endpoints.length === 0;
    });
  }, [resources]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Live overview of your n8n instance
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Workflows"
          value={workflows.isLoading ? null : totalFull}
          subtitle={workflows.isLoading ? 'Loading…' : `${activeCount} active`}
          icon={Workflow}
          href="/workflows"
          color="text-primary"
        />
        <StatCard
          title="Executions (error)"
          value={failed.isLoading ? null : String(failed.data?.data.length ?? 0)}
          subtitle={failed.isLoading ? 'Loading…' : failed.data?.nextCursor ? '100+ recent' : 'most recent'}
          icon={AlertCircle}
          href="/executions?status=error"
          color="text-destructive"
        />
        <StatCard
          title="Running now"
          value={running.isLoading ? null : String(running.data?.data.length ?? 0)}
          subtitle={running.isLoading ? 'Loading…' : 'Auto-refresh 10s'}
          icon={Activity}
          href="/executions?status=running"
          color="text-blue-500"
        />
        <StatCard
          title="Tags"
          value={tagsQ.isLoading ? null : String(tagsQ.data?.data.length ?? 0)}
          subtitle={tagsQ.isLoading ? 'Loading…' : 'Defined'}
          icon={TagIcon}
          href="/tags"
          color="text-green-500"
        />
      </div>

      {/* Recent failed executions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" /> Recent failed executions
              </CardTitle>
              <CardDescription>Last 100 executions with status=error</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/executions?status=error">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {failed.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !failed.data?.data.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              <CheckCircle2 className="inline h-4 w-4 mr-1 text-green-500" />
              No recent failed executions.
            </p>
          ) : (
            <div className="space-y-1">
              {failed.data.data.slice(0, 8).map((e) => (
                <Link
                  key={e.id}
                  href={`/executions/${e.id}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-accent/50 transition-colors text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="destructive" className="font-mono text-[10px]">
                      {e.status}
                    </Badge>
                    <span className="truncate font-mono text-xs">{e.id}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(e.startedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" /> API capabilities
              </CardTitle>
              <CardDescription>
                Detected from <code className="text-xs">GET /discover</code> — reflects what your API key can do
              </CardDescription>
            </div>
            {discover.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {discover.data && (
              <Badge variant={scopes.length ? 'secondary' : 'muted'}>
                {scopes.length
                  ? `${scopes.length} scope${scopes.length === 1 ? '' : 's'}`
                  : 'Unrestricted'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {discover.isLoading ? (
            <Skeleton className="h-32" />
          ) : !discover.data ? (
            <p className="text-sm text-muted-foreground">
              Could not fetch capabilities. Check the connection in settings.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Object.entries(resources ?? {})
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, info]) => (
                  <div
                    key={name}
                    className="rounded-md border bg-muted/30 p-2 text-xs"
                  >
                    <div className="font-mono font-semibold">{name}</div>
                    <div className="text-muted-foreground mt-1">
                      {info.endpoints.length} endpoint{info.endpoints.length === 1 ? '' : 's'} · {info.operations.length} op{info.operations.length === 1 ? '' : 's'}
                    </div>
                  </div>
                ))}
            </div>
          )}
          {erroredResources.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Resources with no exposed endpoints (may be Enterprise-only): {erroredResources.join(', ')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  value: string | null;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="transition-colors group-hover:border-primary/50 group-hover:bg-accent/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {title}
              </p>
              {value === null ? (
                <Skeleton className="h-8 w-20 mt-1" />
              ) : (
                <p className="text-3xl font-semibold mt-1">
                  {formatNumber(Number(value.replace('+', '')))}
                  {value.endsWith('+') && <span className="text-muted-foreground text-lg">+</span>}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <Icon className={`h-8 w-8 ${color} opacity-70`} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
