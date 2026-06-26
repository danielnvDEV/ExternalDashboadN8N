'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/cn';

interface HealthResponse {
  ok: boolean;
  status?: 'up' | 'down' | 'misconfigured';
  baseUrl?: string;
  insecure?: boolean;
  latencyMs?: number;
  message?: string;
  timestamp: string;
}

export function Topbar() {
  const health = useQuery<HealthResponse>({
    queryKey: ['n8n-health'],
    queryFn: async () => {
      const r = await fetch('/api/n8n/health', { cache: 'no-store' });
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const status = health.data;
  const isLoading = health.isLoading || health.isFetching;
  const Icon = isLoading ? Loader2 : status?.ok ? CheckCircle2 : AlertCircle;
  const color = isLoading
    ? 'text-muted-foreground'
    : status?.ok
      ? 'text-green-500'
      : 'text-destructive';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 backdrop-blur px-4">
      <div className="flex-1" />
      <div className="flex items-center gap-3 text-xs">
        <div className={cn('flex items-center gap-1.5', color)}>
          <Icon className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          {status?.ok ? (
            <span>Connected · {status.latencyMs}ms</span>
          ) : status?.status === 'misconfigured' ? (
            <span>Misconfigured</span>
          ) : isLoading ? (
            <span>Checking…</span>
          ) : (
            <span>Disconnected</span>
          )}
        </div>
        {status?.baseUrl && (
          <span className="hidden md:inline text-muted-foreground">
            {status.baseUrl.replace(/^https?:\/\//, '')}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh health"
          onClick={() => health.refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>
      <ThemeToggle />
    </header>
  );
}
