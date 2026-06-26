'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Clock, Gauge, Loader2, TrendingUp, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PageError } from '@/components/capability-gate';
import { apiFetch } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { useToast } from '@/components/ui/toaster';
import type { InsightsSummary } from '@/lib/types';
import { EnterpriseGuard } from '@/components/enterprise-guard';

export default function InsightsPage() {
  const { toast } = useToast();
  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = React.useState('');

  const q = useQuery<InsightsSummary>({
    queryKey: ['n8n-insights', startDate, endDate, projectId],
    queryFn: () =>
      apiFetch('insights/summary', {
        query: {
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          ...(projectId ? { projectId } : {}),
        },
      }),
  });

  return (
    <EnterpriseGuard>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Gauge className="h-7 w-7" /> Insights
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Enterprise feature. Aggregated execution analytics for the selected period.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>End date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Project ID (optional)</Label>
                <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {q.isError ? (
          <PageError error={q.error} />
        ) : q.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : q.data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric icon={BarChart3} label="Total executions" data={q.data.total} color="text-blue-500" />
              <Metric icon={AlertTriangle} label="Failed" data={q.data.failed} color="text-destructive" />
              <Metric icon={TrendingUp} label="Failure rate" data={q.data.failureRate} color="text-yellow-500" suffix="%" />
              <Metric icon={Clock} label="Average run time" data={q.data.averageRunTime} color="text-green-500" />
            </div>
            {q.data.timeSaved && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs uppercase text-muted-foreground">Time saved</p>
                  <p className="text-2xl font-semibold">
                    {formatNumber(q.data.timeSaved.value)} {q.data.timeSaved.unit ?? 'min'}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </EnterpriseGuard>
    );
  }

  function Metric({
    icon: Icon,
    label,
    data,
    color,
    suffix,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    data: { value: number; unit?: string; deviation?: number | null };
    color: string;
    suffix?: string;
  }) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
            <Icon className={`h-4 w-4 ${color} opacity-70`} />
          </div>
          <p className="text-2xl font-semibold mt-1">
            {formatNumber(data?.value ?? 0)}
            {suffix ?? data?.unit ?? ''}
          </p>
          {data?.deviation != null && data.deviation !== 0 && (
            <p className={`text-[10px] mt-1 ${data.deviation > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {data.deviation > 0 ? '+' : ''}
              {data.deviation.toFixed(1)}% vs previous period
            </p>
          )}
        </CardContent>
      </Card>
  );
}
