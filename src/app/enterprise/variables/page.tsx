'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Trash2, Variable } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CursorPagination, useCursorPagination } from '@/components/data-table/pagination-cursor';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type { Variable as Var } from '@/lib/types';
import { EnterpriseGuard } from '@/components/enterprise-guard';

export default function VariablesPage() {
  const { toast } = useToast();
  const [key, setKey] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newKey, setNewKey] = React.useState('');
  const [newValue, setNewValue] = React.useState('');

  const q = useCursorPagination<Var>('variables', { limit: 100, ...(key ? { filter: JSON.stringify({ key }) } : {}) }, {
    queryKey: [key],
  });

  const onCreate = async () => {
    if (!newKey.trim()) return;
    try {
      await apiFetch('variables', { method: 'POST', body: { key: newKey.trim(), value: newValue } });
      toast({ title: 'Created', variant: 'success' });
      setNewKey('');
      setNewValue('');
      setCreateOpen(false);
      q.refetch();
    } catch (e) {
      toast({ title: 'Create failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onUpdate = async (v: Var) => {
    const newVal = window.prompt(`New value for "${v.key}":`, v.value);
    if (newVal === null) return;
    try {
      await apiFetch(`variables/${v.id}`, { method: 'PUT', body: { key: v.key, value: newVal } });
      toast({ title: 'Updated', variant: 'success' });
      q.refetch();
    } catch (e) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onDelete = async (v: Var) => {
    await apiFetch(`variables/${v.id}`, { method: 'DELETE' });
    q.refetch();
    toast({ title: 'Deleted', description: v.key });
  };

  return (
    <EnterpriseGuard>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
              <Variable className="h-7 w-7" /> Variables
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Enterprise-only. Instance or project-scoped key/value pairs.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New variable
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filter by key…" value={key} onChange={(e) => setKey(e.target.value)} className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            {q.isError ? (
              <PageError error={q.error} />
            ) : q.isLoading ? (
              <Skeleton className="h-32" />
            ) : q.data.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No variables.</p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="text-left p-2 font-medium w-1/3">Key</th>
                      <th className="text-left p-2 font-medium">Value</th>
                      <th className="w-20 p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.map((v) => (
                      <tr key={v.id} className="border-t">
                        <td className="p-2 font-mono">{v.key}</td>
                        <td className="p-2 font-mono text-xs truncate max-w-0">{v.value}</td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => onUpdate(v)}>Edit</Button>
                          <ConfirmDialog
                            trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                            title={`Delete variable "${v.key}"?`}
                            confirmText="Delete"
                            onConfirm={() => onDelete(v)}
                          />
                        </td>
                      </tr>
                    ))}
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

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New variable</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>Key</Label>
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="API_BASE_URL" />
              <Label>Value</Label>
              <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={onCreate} disabled={!newKey.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EnterpriseGuard>
  );
}
