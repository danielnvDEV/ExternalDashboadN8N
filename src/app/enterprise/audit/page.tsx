'use client';

import * as React from 'react';
import { AlertTriangle, Loader2, Shield, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api-client';
import { CodeViewer } from '@/components/code-viewer';
import type { AuditCategory, AuditReport } from '@/lib/types';
import { EnterpriseGuard } from '@/components/enterprise-guard';

const CATEGORIES: AuditCategory[] = ['credentials', 'database', 'nodes', 'filesystem', 'instance'];

export default function AuditPage() {
  const { toast } = useToast();
  const [days, setDays] = React.useState(30);
  const [categories, setCategories] = React.useState<AuditCategory[]>(['credentials', 'database', 'nodes', 'filesystem', 'instance']);
  const [report, setReport] = React.useState<AuditReport | null>(null);
  const [loading, setLoading] = React.useState(false);

  const run = async () => {
    try {
      setLoading(true);
      setReport(null);
      const r = await apiFetch<AuditReport>('audit', {
        method: 'POST',
        body: { additionalOptions: { daysAbandonedWorkflow: days, categories } },
      });
      setReport(r);
      toast({ title: 'Audit complete', variant: 'success' });
    } catch (e) {
      toast({ title: 'Audit failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <EnterpriseGuard>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-7 w-7" /> Security audit
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Enterprise / Security Audit feature. Generates a report of risks in your instance.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run audit</CardTitle>
            <CardDescription>POST /audit with selected categories.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Days for &quot;abandoned workflow&quot; threshold</Label>
              <Input
                type="number"
                value={days}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 30))}
                className="mt-1 max-w-[200px]"
              />
            </div>
            <div>
              <Label>Categories</Label>
              <div className="mt-1 flex flex-wrap gap-3">
                {CATEGORIES.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={categories.includes(c)}
                      onCheckedChange={(checked) => {
                        setCategories((prev) =>
                          checked ? [...new Set([...prev, c])] : prev.filter((x) => x !== c),
                        );
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={run} disabled={loading || categories.length === 0}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldAlert className="h-4 w-4 mr-1" />}
              Run audit
            </Button>
          </CardContent>
        </Card>

        {report && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Report
              </CardTitle>
              <CardDescription>Full report from n8n</CardDescription>
            </CardHeader>
            <CardContent>
              <CodeViewer data={report} maxHeight="700px" />
            </CardContent>
          </Card>
        )}
      </div>
    </EnterpriseGuard>
  );
}
