'use client';

import * as React from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api-client';

export default function ExportPackagePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [workflowIds, setWorkflowIds] = React.useState('');
  const [credentials, setCredentials] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const onExport = async () => {
    try {
      setLoading(true);
      const ids = workflowIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const body: Record<string, unknown> = {};
      if (ids.length) body.workflowIds = ids;
      // credentials export options can be added later
      void credentials;
      const res = await fetch('/api/n8n/n8n-packages/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `package-${new Date().toISOString().slice(0, 10)}.n8np`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Download started', variant: 'success' });
    } catch (e) {
      toast({ title: 'Export failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Button variant="ghost" size="sm" onClick={() => router.push('/packages')} className="mb-2">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export package</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Send <code className="text-xs">POST /n8n-packages/export</code> and download the resulting{' '}
          <code className="text-xs">.n8np</code> gzipped tar.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <Label>Workflow IDs (one per line or comma-separated, leave empty for all)</Label>
            <Textarea
              value={workflowIds}
              onChange={(e) => setWorkflowIds(e.target.value)}
              className="mt-1 font-mono text-xs h-32"
              placeholder="abc123&#10;def456"
            />
          </div>
        </CardContent>
      </Card>
      <Button onClick={onExport} disabled={loading}>
        <Download className="h-4 w-4 mr-1" /> {loading ? 'Exporting…' : 'Export and download'}
      </Button>
    </div>
  );
}
