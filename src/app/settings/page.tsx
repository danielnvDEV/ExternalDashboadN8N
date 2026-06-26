'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Copy, ExternalLink, Server, Shield, Webhook } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CodeViewer } from '@/components/code-viewer';
import { useToast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api-client';
import type { DiscoverResponse } from '@/lib/types';

export default function SettingsPage() {
  const { toast } = useToast();
  const health = useQuery({
    queryKey: ['n8n-health-full'],
    queryFn: () => apiFetch<{ ok: boolean; baseUrl?: string; insecure?: boolean; latencyMs?: number; message?: string; status?: string }>('health'),
  });
  const discover = useQuery<DiscoverResponse>({
    queryKey: ['n8n-discover-detail'],
    queryFn: () => apiFetch<DiscoverResponse>('discover'),
  });
  const capabilities = discover.data?.data;
  const scopes = capabilities?.scopes ?? [];
  const resources = capabilities?.resources ?? {};

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connection status and API capabilities
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <CardTitle className="text-base">Connection</CardTitle>
          </div>
          <CardDescription>Where the dashboard is connecting to</CardDescription>
        </CardHeader>
        <CardContent>
          {health.isLoading ? (
            <Skeleton className="h-16" />
          ) : health.data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <KV k="Base URL" v={health.data.baseUrl ?? '-'} mono />
              <KV
                k="Status"
                v={
                  health.data.ok ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="text-destructive">{health.data.status ?? 'down'}</span>
                  )
                }
              />
              <KV k="Latency" v={health.data.latencyMs ? `${health.data.latencyMs} ms` : '-'} />
              <KV
                k="Protocol"
                v={
                  health.data.insecure ? (
                    <Badge variant="warning">HTTP (insecure)</Badge>
                  ) : (
                    <Badge variant="success">HTTPS</Badge>
                  )
                }
              />
              {health.data.message && <KV k="Error" v={<span className="text-destructive">{health.data.message}</span>} />}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <CardTitle className="text-base">API key scopes</CardTitle>
          </div>
          <CardDescription>
            Reflects the scopes granted to the API key configured in <code className="text-xs">.env</code>.
            Enterprise keys have restricted scopes; non-Enterprise keys have unrestricted access (no scopes shown).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {discover.isLoading ? (
            <Skeleton className="h-20" />
          ) : !discover.data ? (
            <p className="text-sm text-muted-foreground">Could not load /discover.</p>
          ) : scopes.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <Badge variant="muted" className="mr-2">Unrestricted</Badge>
              Non-Enterprise API key with full instance access.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {scopes.map((s) => (
                <Badge key={s} variant="secondary" className="font-mono text-[11px]">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              <CardTitle className="text-base">Discovered resources</CardTitle>
            </div>
            {discover.data && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(JSON.stringify(discover.data, null, 2));
                  toast({ title: 'Copied', description: 'Discovered capabilities JSON', variant: 'success' });
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy JSON
              </Button>
            )}
          </div>
          <CardDescription>
            Endpoint map returned by <code className="text-xs">GET /api/v1/discover</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {discover.isLoading ? (
            <Skeleton className="h-48" />
          ) : !discover.data ? (
            <p className="text-sm text-muted-foreground">No data.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(resources)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, info]) => (
                  <div key={name}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-mono text-sm font-semibold">{name}</h3>
                      <Badge variant="muted" className="text-[10px]">
                        {info.endpoints.length} endpoint{info.endpoints.length === 1 ? '' : 's'}
                      </Badge>
                      <Badge variant="muted" className="text-[10px]">
                        {info.operations.length} op{info.operations.length === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <div className="rounded-md border bg-muted/20 divide-y">
                      {info.endpoints.map((ep) => (
                        <div key={`${ep.method}-${ep.path}`} className="px-3 py-1.5 flex items-center gap-3 text-xs font-mono">
                          <Badge
                            variant={
                              ep.method === 'GET'
                                ? 'info'
                                : ep.method === 'POST'
                                  ? 'success'
                                  : ep.method === 'DELETE'
                                    ? 'destructive'
                                    : 'warning'
                            }
                            className="text-[10px] w-14 justify-center"
                          >
                            {ep.method}
                          </Badge>
                          <span className="flex-1 truncate">{ep.path}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment</CardTitle>
          <CardDescription>Variables read from <code className="text-xs">.env</code> on the server</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeViewer
            data={{
              N8N_BASE_URL: '(from env)',
              N8N_API_KEY: '(hidden)',
              N8N_VERIFY_TLS: '(from env)',
              N8N_TIMEOUT_MS: '(from env)',
              NEXT_PUBLIC_APP_NAME: '(from env)',
            }}
            showCopy={false}
            maxHeight="200px"
          />
          <Separator className="my-3" />
          <p className="text-xs text-muted-foreground">
            The API key is never sent to the browser. The dashboard always proxies through Next.js Route Handlers.
            See <a href="https://docs.n8n.io/api/authentication/" className="underline inline-flex items-center">docs <ExternalLink className="h-3 w-3 ml-0.5" /></a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{k}</p>
      <div className={`mt-1 ${mono ? 'font-mono text-xs' : ''}`}>{v}</div>
    </div>
  );
}
