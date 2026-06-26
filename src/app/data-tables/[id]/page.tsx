'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Code,
  Database,
  Edit,
  Filter,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CodeViewer } from '@/components/code-viewer';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type {
  DataTable,
  DataTableColumn,
  DataTableColumnType,
  DataTableRowFilter,
  DataTableRowFilterCondition,
} from '@/lib/types';

export default function DataTableDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id;

  const [search, setSearch] = React.useState('');
  const [sortBy, setSortBy] = React.useState('');
  const [filterText, setFilterText] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [rows, setRows] = React.useState<Array<Record<string, unknown>>>([]);
  const [editingRow, setEditingRow] = React.useState<Record<string, unknown> | null>(null);
  const [insertOpen, setInsertOpen] = React.useState(false);

  const tableQ = useQuery<DataTable>({
    queryKey: ['n8n-dt', id],
    queryFn: () => apiFetch(`data-tables/${id}`),
  });

  const fetchRows = React.useCallback(async () => {
    try {
      const params: Record<string, string | number> = { limit: 100, skip: page * 100 };
      if (search) params.search = search;
      if (sortBy) params.sortBy = sortBy;
      if (filterText.trim()) {
        try {
          JSON.parse(filterText);
          params.filter = filterText;
        } catch {
          /* ignore invalid */
        }
      }
      const r = await apiFetch<{ data: Array<Record<string, unknown>>; count: number }>(
        `data-tables/${id}/rows`,
        { query: params },
      );
      setRows(r.data ?? []);
    } catch {
      setRows([]);
    }
  }, [id, page, search, sortBy, filterText]);

  React.useEffect(() => {
    if (tableQ.data) fetchRows();
  }, [tableQ.data, fetchRows]);

  const onInsert = async (data: Record<string, unknown>) => {
    try {
      const result = await apiFetch<{ count?: number; data?: unknown[] }>(
        `data-tables/${id}/rows`,
        { method: 'POST', body: { data: [data], returnType: 'all' } },
      );
      toast({
        title: 'Row inserted',
        description: result.count ? `${result.count} row added` : 'Done',
        variant: 'success',
      });
      setInsertOpen(false);
      fetchRows();
    } catch (e) {
      toast({ title: 'Insert failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onUpdateRow = async (data: Record<string, unknown>) => {
    try {
      // Need at least one filter; for single-row update, use a synthetic filter on the first column.
      const firstCol = tableQ.data?.columns[0];
      if (!firstCol) {
        toast({ title: 'No column to match', variant: 'destructive' });
        return;
      }
      const filter: DataTableRowFilter = {
        type: 'and',
        filters: [{ columnName: firstCol.name, condition: 'eq', value: data[firstCol.name] }],
      };
      await apiFetch(`data-tables/${id}/rows/update`, {
        method: 'PATCH',
        body: { filter, data, returnData: false },
      });
      toast({ title: 'Row updated', variant: 'success' });
      setEditingRow(null);
      fetchRows();
    } catch (e) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onDeleteRow = async (row: Record<string, unknown>) => {
    const firstCol = tableQ.data?.columns[0];
    if (!firstCol) return;
    try {
      const filter: DataTableRowFilter = {
        type: 'and',
        filters: [{ columnName: firstCol.name, condition: 'eq', value: row[firstCol.name] }],
      };
      await apiFetch(
        `data-tables/${id}/rows/delete?filter=${encodeURIComponent(JSON.stringify(filter))}`,
        { method: 'DELETE' },
      );
      toast({ title: 'Row deleted', variant: 'success' });
      fetchRows();
    } catch (e) {
      toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  if (tableQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (tableQ.isError) return <PageError error={tableQ.error} />;
  if (!tableQ.data) return null;
  const t = tableQ.data;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/data-tables')} className="mb-2">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6" /> {t.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{t.id}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {t.columns.map((c) => (
              <Badge key={c.id ?? c.name} variant="outline" className="text-[10px] font-mono">
                {c.name}:{c.type}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={() => setInsertOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Insert row
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push(`/data-tables/${id}/schema`)}>
            <Edit className="h-3.5 w-3.5 mr-1" /> Schema
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rows</CardTitle>
          <CardDescription>
            Use the filter DSL to build conditions: <code className="text-xs">&#123;type:&quot;and&quot;,filters:[&#123;columnName,condition,value&#125;]&#125;</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-8"
              />
            </div>
            <Select value={sortBy || 'none'} onValueChange={(v) => setSortBy(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No sort</SelectItem>
                {t.columns.map((c) => (
                  <SelectItem key={`${c.name}-asc`} value={`${c.name}:asc`}>
                    {c.name} ↑
                  </SelectItem>
                ))}
                {t.columns.map((c) => (
                  <SelectItem key={`${c.name}-desc`} value={`${c.name}:desc`}>
                    {c.name} ↓
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Button onClick={fetchRows} size="sm" variant="outline">
                <Filter className="h-3.5 w-3.5 mr-1" /> Apply
              </Button>
              <Button
                onClick={() => { setSearch(''); setSortBy(''); setPage(0); }}
                size="sm"
                variant="ghost"
              >
                Reset
              </Button>
            </div>
          </div>
          <details className="rounded-md border bg-muted/30 p-2 text-xs">
            <summary className="cursor-pointer font-medium">Advanced filter (JSON DSL)</summary>
            <Textarea
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder='{"type":"and","filters":[{"columnName":"status","condition":"eq","value":"active"}]}'
              className="mt-2 font-mono text-[11px] h-28"
            />
            <p className="text-muted-foreground mt-1">
              Click <strong>Apply</strong> to send. Conditions: <code>eq,neq,gt,lt,gte,lte,like,ilike</code> and more depending on column type.
            </p>
          </details>

          <div className="rounded-md border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  {t.columns.map((c) => (
                    <th key={c.id ?? c.name} className="text-left p-2 font-medium font-mono">
                      {c.name}
                      <Badge variant="muted" className="ml-1 text-[9px] font-sans">{c.type}</Badge>
                    </th>
                  ))}
                  <th className="w-16 p-2" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={t.columns.length + 1} className="p-6 text-center text-muted-foreground">
                      No rows.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      {t.columns.map((c) => (
                        <td key={c.id ?? c.name} className="p-2 font-mono text-xs max-w-[280px] truncate">
                          {formatCell(r[c.name])}
                        </td>
                      ))}
                      <td className="p-2 text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => setEditingRow({ ...r })} aria-label="Edit row">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button size="icon" variant="ghost" aria-label="Delete row">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          }
                          title="Delete row?"
                          description="This will remove the row from the table."
                          confirmText="Delete"
                          onConfirm={() => onDeleteRow(r)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {rows.length === 0 ? 'No rows' : `Showing ${rows.length} row${rows.length === 1 ? '' : 's'}`}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                Prev
              </Button>
              <span className="px-2 text-muted-foreground">Page {page + 1}</span>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={rows.length < 100}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {insertOpen && (
        <RowFormDialog
          columns={t.columns}
          initial={null}
          title="Insert row"
          onClose={() => setInsertOpen(false)}
          onSave={onInsert}
        />
      )}

      {editingRow && (
        <RowFormDialog
          columns={t.columns}
          initial={editingRow}
          title="Edit row"
          onClose={() => setEditingRow(null)}
          onSave={onUpdateRow}
        />
      )}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function RowFormDialog({
  columns,
  initial,
  title,
  onClose,
  onSave,
}: {
  columns: DataTableColumn[];
  initial: Record<string, unknown> | null;
  title: string;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [data, setData] = React.useState<Record<string, unknown>>(
    initial ?? Object.fromEntries(columns.map((c) => [c.name, defaultFor(c.type)])),
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Fill the row fields. Booleans toggle, dates use ISO format.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {columns.map((c) => (
            <div key={c.id ?? c.name}>
              <Label className="font-mono text-xs">
                {c.name} <Badge variant="muted" className="text-[9px] font-sans">{c.type}</Badge>
              </Label>
              <Input
                value={data[c.name] === null || data[c.name] === undefined ? '' : String(data[c.name])}
                onChange={(e) => {
                  let v: unknown = e.target.value;
                  if (c.type === 'number') v = e.target.value === '' ? null : Number(e.target.value);
                  if (c.type === 'boolean') v = e.target.value === 'true';
                  if (c.type === 'date' && e.target.value) v = new Date(e.target.value).toISOString();
                  setData((d) => ({ ...d, [c.name]: v }));
                }}
                placeholder={c.type === 'date' ? 'YYYY-MM-DD or ISO' : ''}
                className="mt-1 font-mono text-xs"
                type={c.type === 'date' ? 'datetime-local' : c.type === 'number' ? 'number' : 'text'}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(data)}>
            <Save className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultFor(type: DataTableColumnType): unknown {
  if (type === 'boolean') return false;
  if (type === 'number') return 0;
  return '';
}
