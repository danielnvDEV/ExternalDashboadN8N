'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Code, Database, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CodeViewer } from '@/components/code-viewer';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type { DataTable, DataTableColumn, DataTableColumnType } from '@/lib/types';

const COLUMN_TYPES: DataTableColumnType[] = ['string', 'number', 'date', 'boolean'];

export default function DataTableSchemaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id;

  const tableQ = useQuery<DataTable>({
    queryKey: ['n8n-dt', id],
    queryFn: () => apiFetch(`data-tables/${id}`),
  });

  const [renameOpen, setRenameOpen] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState('');
  const [addOpen, setAddOpen] = React.useState(false);
  const [newCol, setNewCol] = React.useState<{ name: string; type: DataTableColumnType }>({ name: '', type: 'string' });

  const onRenameTable = async () => {
    try {
      await apiFetch(`data-tables/${id}`, { method: 'PATCH', body: { name: renameValue } });
      toast({ title: 'Renamed', variant: 'success' });
      setRenameOpen(false);
      tableQ.refetch();
    } catch (e) {
      toast({ title: 'Rename failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onAddCol = async () => {
    if (!newCol.name.trim()) return;
    try {
      await apiFetch(`data-tables/${id}/columns`, { method: 'POST', body: newCol });
      toast({ title: 'Column added', variant: 'success' });
      setAddOpen(false);
      setNewCol({ name: '', type: 'string' });
      tableQ.refetch();
    } catch (e) {
      toast({ title: 'Add failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onRenameCol = async (col: DataTableColumn) => {
    const newName = window.prompt(`Rename column "${col.name}" to:`, col.name);
    if (!newName || newName === col.name) return;
    try {
      await apiFetch(`data-tables/${id}/columns/${col.id}`, { method: 'PATCH', body: { name: newName } });
      toast({ title: 'Renamed', variant: 'success' });
      tableQ.refetch();
    } catch (e) {
      toast({ title: 'Rename failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onDeleteCol = async (col: DataTableColumn) => {
    try {
      await apiFetch(`data-tables/${id}/columns/${col.id}`, { method: 'DELETE' });
      toast({ title: 'Column deleted', variant: 'success' });
      tableQ.refetch();
    } catch (e) {
      toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  if (tableQ.isLoading) return <Skeleton className="h-48" />;
  if (tableQ.isError) return <PageError error={tableQ.error} />;
  if (!tableQ.data) return null;
  const t = tableQ.data;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push(`/data-tables/${id}`)} className="mb-2">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to table
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6" /> {t.name} — Schema
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">{t.id}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => { setRenameValue(t.name); setRenameOpen(true); }}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Rename table
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add column
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Columns</CardTitle>
          <CardDescription>Each column is one of string, number, date, boolean.</CardDescription>
        </CardHeader>
        <CardContent>
          {t.columns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No columns.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left p-2 font-medium w-12">#</th>
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium w-32">Type</th>
                    <th className="text-left p-2 font-medium w-12">Idx</th>
                    <th className="w-20 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {t.columns.map((c, i) => (
                    <tr key={c.id ?? c.name} className="border-t">
                      <td className="p-2 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="p-2 font-mono">{c.name}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-[10px] font-mono">{c.type}</Badge>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{c.index ?? '-'}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => onRenameCol(c)} aria-label="Rename">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button size="icon" variant="ghost" aria-label="Delete column">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          }
                          title={`Delete column "${c.name}"?`}
                          description="This will erase all data in this column."
                          confirmText="Delete"
                          onConfirm={() => onDeleteCol(c)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename table</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={onRenameTable}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add column</DialogTitle>
            <DialogDescription>New column starts empty. Populate via row inserts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={newCol.name} onChange={(e) => setNewCol({ ...newCol, name: e.target.value })} />
            <Label>Type</Label>
            <Select value={newCol.type} onValueChange={(v) => setNewCol({ ...newCol, type: v as DataTableColumnType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLUMN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={onAddCol}><Save className="h-3.5 w-3.5 mr-1" /> Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
