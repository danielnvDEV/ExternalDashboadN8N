'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ExternalLink,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CodeViewer } from '@/components/code-viewer';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { absoluteTime, relativeTime } from '@/lib/format';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Credential, CredentialSchema } from '@/lib/types';

export default function CredentialDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id;

  const credQ = useQuery<Credential>({
    queryKey: ['n8n-cred', id],
    queryFn: () => apiFetch(`credentials/${id}`),
  });

  const schemaQ = useQuery<CredentialSchema>({
    queryKey: ['n8n-cred-schema', credQ.data?.type],
    queryFn: () => apiFetch(`credentials/schema/${encodeURIComponent(credQ.data!.type)}`),
    enabled: !!credQ.data?.type,
  });

  const [data, setData] = React.useState<Record<string, unknown>>({});
  const [name, setName] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferProjectId, setTransferProjectId] = React.useState('');

  React.useEffect(() => {
    if (credQ.data) setName(credQ.data.name);
  }, [credQ.data]);

  const onTest = async () => {
    try {
      const r = await apiFetch<{ status?: string; message?: string }>(`credentials/${id}/test`, {
        method: 'POST',
      });
      toast({
        title: 'Test OK',
        description: r?.message ?? 'Credential is valid',
        variant: 'success',
      });
    } catch (e) {
      toast({
        title: 'Test failed',
        description: (e as Error).message,
        variant: 'destructive',
      });
    }
  };

  const onSave = async () => {
    try {
      setSubmitting(true);
      await apiFetch(`credentials/${id}`, {
        method: 'PATCH',
        body: { name, data: Object.keys(data).length ? data : undefined },
      });
      credQ.refetch();
      toast({ title: 'Saved', variant: 'success' });
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    await apiFetch(`credentials/${id}`, { method: 'DELETE' });
    toast({ title: 'Deleted', variant: 'success' });
    router.push('/credentials');
  };

  const onTransfer = async () => {
    if (!transferProjectId) return;
    try {
      await apiFetch(`credentials/${id}/transfer`, {
        method: 'PUT',
        body: { destinationProjectId: transferProjectId },
      });
      credQ.refetch();
      setTransferOpen(false);
      toast({ title: 'Transferred', variant: 'success' });
    } catch (e) {
      toast({ title: 'Transfer failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  if (credQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (credQ.isError) return <PageError error={credQ.error} />;
  if (!credQ.data) return null;
  const c = credQ.data;

  return (
    <div className="space-y-4 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => router.push('/credentials')} className="mb-2">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight truncate flex items-center gap-2">
              <KeyRound className="h-6 w-6" /> {c.name}
            </h1>
            <Badge variant="outline" className="font-mono text-[10px]">{c.type}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{c.id}</p>
          <p className="text-xs text-muted-foreground">
            Created {relativeTime(c.createdAt)} · Updated {relativeTime(c.updatedAt)}
            {c.homeProject && <> · Project: {c.homeProject.name}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={onTest}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Test
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Transfer
          </Button>
          <ConfirmDialog
            trigger={<Button size="sm" variant="destructive"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>}
            title={`Delete "${c.name}"?`}
            description="Workflows using this credential will lose access."
            confirmText="Delete"
            onConfirm={onDelete}
          />
        </div>
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="meta">Metadata</TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update credential</CardTitle>
              <CardDescription>
                The current <code className="text-xs">data</code> is not returned by the API. Fill the fields you want to change; the rest will remain untouched.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="cname">Name</Label>
                <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
              </div>
              {schemaQ.isLoading ? (
                <Skeleton className="h-20" />
              ) : schemaQ.data ? (
                <SchemaForm schema={schemaQ.data} value={data} onChange={setData} />
              ) : (
                <p className="text-sm text-muted-foreground">Schema not available.</p>
              )}
              <Button onClick={onSave} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="meta">
          <Card>
            <CardContent className="pt-6">
              <CodeViewer
                data={{
                  id: c.id,
                  name: c.name,
                  type: c.type,
                  isResolvable: c.isResolvable,
                  isGlobal: c.isGlobal,
                  homeProject: c.homeProject,
                  sharedWithProjects: c.sharedWithProjects,
                  scopes: c.scopes,
                  createdAt: c.createdAt,
                  updatedAt: c.updatedAt,
                }}
                maxHeight="500px"
              />
              <p className="text-[11px] text-muted-foreground mt-3">
                Created: {absoluteTime(c.createdAt)} · Updated: {absoluteTime(c.updatedAt)}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer credential</DialogTitle>
            <DialogDescription>
              Move this credential to a different project (Enterprise/RBAC only).
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Destination project ID"
            value={transferProjectId}
            onChange={(e) => setTransferProjectId(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={onTransfer} disabled={!transferProjectId}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SchemaForm({
  schema,
  value,
  onChange,
}: {
  schema: CredentialSchema;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      {Object.entries(props).map(([key, propRaw]) => {
        const prop = propRaw as {
          type?: string;
          title?: string;
          description?: string;
          default?: unknown;
          enum?: unknown[];
          format?: string;
          typeOptions?: { password?: boolean; rows?: number };
        };
        const label = prop.title ?? key;
        const isPassword =
          prop.typeOptions?.password ||
          prop.format === 'password' ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token');
        const isLong = prop.type === 'string' && (prop.typeOptions?.rows ?? 0) > 1;
        return (
          <div key={key}>
            <Label htmlFor={`f-${key}`}>
              {label} {required.has(key) && <span className="text-destructive">*</span>}
            </Label>
            {prop.description && <p className="text-[11px] text-muted-foreground mt-0.5">{prop.description}</p>}
            {prop.enum ? (
              <Select value={(value[key] as string) ?? ''} onValueChange={(v) => set(key, v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {(prop.enum as string[]).map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : isLong ? (
              <Textarea
                id={`f-${key}`}
                value={(value[key] as string) ?? ''}
                onChange={(e) => set(key, e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            ) : (
              <Input
                id={`f-${key}`}
                type={isPassword ? 'password' : 'text'}
                value={(value[key] as string) ?? ''}
                onChange={(e) => set(key, e.target.value)}
                placeholder={prop.default !== undefined ? String(prop.default) : undefined}
                className="mt-1"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
