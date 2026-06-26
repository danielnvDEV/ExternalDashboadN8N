'use client';

import * as React from 'react';
import { Boxes, Download, GitPullRequest, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toaster';
import { CodeViewer } from '@/components/code-viewer';
import { apiFetch } from '@/lib/api-client';
import type { SourceControlAutoPublish, SourceControlFile } from '@/lib/types';
import { EnterpriseGuard } from '@/components/enterprise-guard';

export default function SourceControlPage() {
  const { toast } = useToast();
  const [force, setForce] = React.useState(false);
  const [autoPublish, setAutoPublish] = React.useState<SourceControlAutoPublish>('none');
  const [loading, setLoading] = React.useState(false);
  const [files, setFiles] = React.useState<SourceControlFile[] | null>(null);

  const onPull = async () => {
    try {
      setLoading(true);
      const r = await apiFetch<SourceControlFile[]>('source-control/pull', {
        method: 'POST',
        body: { force, autoPublish },
      });
      setFiles(r);
      toast({ title: 'Pull complete', description: `${r.length} file(s) processed`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Pull failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <EnterpriseGuard>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Boxes className="h-7 w-7" /> Source control
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Enterprise / Source Control feature. Pull workflow changes from the connected Git repository.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pull</CardTitle>
            <CardDescription>
              <code className="text-xs">POST /source-control/pull</code> with <code className="text-xs">autoPublish</code> and optional <code className="text-xs">force</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Auto-publish</Label>
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                {(['none', 'all', 'published'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="autoPublish"
                      value={v}
                      checked={autoPublish === v}
                      onChange={() => setAutoPublish(v)}
                    />
                    {v}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={force} onCheckedChange={(v) => setForce(!!v)} />
              <span>
                <strong>Force</strong> — discard local changes on conflict (409)
              </span>
            </label>
            <Button onClick={onPull} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <GitPullRequest className="h-4 w-4 mr-1" />}
              Pull from Git
            </Button>
          </CardContent>
        </Card>

        {files && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Result ({files.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files changed.</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs">
                      <tr>
                        <th className="text-left p-2 font-medium">File</th>
                        <th className="text-left p-2 font-medium w-24">Type</th>
                        <th className="text-left p-2 font-medium w-32">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((f) => (
                        <tr key={`${f.file}-${f.id}`} className="border-t">
                          <td className="p-2 font-mono text-xs">{f.file}</td>
                          <td className="p-2"><Badge variant="muted" className="text-[10px]">{f.type}</Badge></td>
                          <td className="p-2">
                            {f.conflict ? (
                              <Badge variant="destructive" className="text-[10px]">conflict</Badge>
                            ) : (
                              <Badge variant="muted" className="text-[10px]">{f.status ?? 'ok'}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer">Raw response</summary>
                <CodeViewer data={files} maxHeight="400px" />
              </details>
            </CardContent>
          </Card>
        )}
      </div>
    </EnterpriseGuard>
  );
}
