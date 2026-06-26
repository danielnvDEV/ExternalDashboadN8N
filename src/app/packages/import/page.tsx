'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Package, Upload, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toaster';
import { CodeViewer } from '@/components/code-viewer';
import type {
  CredentialMatchingMode,
  CredentialMissingMode,
  N8nPackageImportResult,
  WorkflowConflictPolicy,
  WorkflowIdPolicy,
  WorkflowPublishingPolicy,
} from '@/lib/types';

export default function ImportPackagePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [conflictPolicy, setConflictPolicy] = React.useState<WorkflowConflictPolicy>('new-version');
  const [credMatching, setCredMatching] = React.useState<CredentialMatchingMode>('id-only');
  const [credMissing, setCredMissing] = React.useState<CredentialMissingMode>('create-stub');
  const [workflowIdPolicy, setWorkflowIdPolicy] = React.useState<WorkflowIdPolicy>('new');
  const [publishing, setPublishing] = React.useState<WorkflowPublishingPolicy>('preserve-published-state');
  const [projectId, setProjectId] = React.useState('');
  const [folderId, setFolderId] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<N8nPackageImportResult | null>(null);

  const onImport = async () => {
    if (!file) return;
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append('package', file);
      fd.append('workflowConflictPolicy', conflictPolicy);
      fd.append('credentialMatchingMode', credMatching);
      fd.append('credentialMissingMode', credMissing);
      fd.append('workflowIdPolicy', workflowIdPolicy);
      fd.append('workflowPublishingPolicy', publishing);
      if (projectId) fd.append('projectId', projectId);
      if (folderId) fd.append('folderId', folderId);

      const res = await fetch('/api/n8n/n8n-packages/import', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? `Status ${res.status}`);
      setResult(json as N8nPackageImportResult);
      toast({ title: 'Import complete', variant: 'success' });
    } catch (e) {
      toast({ title: 'Import failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => router.push('/packages')} className="mb-2">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Package className="h-6 w-6" /> Import package
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload a <code className="text-xs">.n8np</code> archive (max 16MB by default).
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <Label>.n8np file</Label>
            <Input
              type="file"
              accept=".n8np,.tar.gz,.gz,application/gzip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Workflow conflict policy</Label>
              <Select value={conflictPolicy} onValueChange={(v) => setConflictPolicy(v as WorkflowConflictPolicy)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new-version">Create new version</SelectItem>
                  <SelectItem value="fail">Fail on conflict</SelectItem>
                  <SelectItem value="skip">Skip existing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Credential matching</Label>
              <Select value={credMatching} onValueChange={(v) => setCredMatching(v as CredentialMatchingMode)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="id-only">Match by id only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Missing credentials</Label>
              <Select value={credMissing} onValueChange={(v) => setCredMissing(v as CredentialMissingMode)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="create-stub">Create stub</SelectItem>
                  <SelectItem value="must-preexist">Require pre-existing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Workflow IDs</Label>
              <Select value={workflowIdPolicy} onValueChange={(v) => setWorkflowIdPolicy(v as WorkflowIdPolicy)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Generate new</SelectItem>
                  <SelectItem value="source">Use source IDs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Publishing</Label>
              <Select value={publishing} onValueChange={(v) => setPublishing(v as WorkflowPublishingPolicy)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preserve-published-state">Preserve source state</SelectItem>
                  <SelectItem value="match-source">Match source</SelectItem>
                  <SelectItem value="publish-all">Publish all</SelectItem>
                  <SelectItem value="unpublish-all">Unpublish all</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project ID (optional)</Label>
              <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Folder ID (optional)</Label>
              <Input value={folderId} onChange={(e) => setFolderId(e.target.value)} className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={onImport} disabled={!file || loading}>
        <Upload className="h-4 w-4 mr-1" /> {loading ? 'Importing…' : 'Import'}
      </Button>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
            <CardDescription>Per-workflow and per-credential status from the n8n import.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.workflows && result.workflows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Workflows</h3>
                <div className="space-y-1">
                  {result.workflows.map((w, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1 text-xs">
                      <span className="truncate">{w.name ?? w.id ?? `Workflow ${i + 1}`}</span>
                      <Badge
                        variant={w.status === 'created' ? 'success' : w.status === 'updated' ? 'info' : w.status === 'skipped' ? 'muted' : 'destructive'}
                        className="text-[10px]"
                      >
                        {w.status === 'failed' ? <XCircle className="h-3 w-3 mr-0.5" /> : <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                        {w.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.credentials && result.credentials.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Credentials</h3>
                <div className="space-y-1">
                  {result.credentials.map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1 text-xs">
                      <span className="truncate">{c.name ?? c.type ?? `Credential ${i + 1}`}</span>
                      <Badge
                        variant={c.status === 'matched' ? 'success' : c.status === 'stub' ? 'info' : c.status === 'skipped' ? 'muted' : 'destructive'}
                        className="text-[10px]"
                      >
                        {c.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <details>
              <summary className="text-xs text-muted-foreground cursor-pointer">Raw response</summary>
              <CodeViewer data={result} maxHeight="400px" />
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
