'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, Plus, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api-client';
import type { DataTableColumnType } from '@/lib/types';

const COLUMN_TYPES: DataTableColumnType[] = ['string', 'number', 'date', 'boolean'];

export default function NewDataTablePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [columns, setColumns] = React.useState<Array<{ name: string; type: DataTableColumnType }>>([
    { name: '', type: 'string' },
  ]);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async () => {
    const cleanCols = columns
      .map((c) => ({ name: c.name.trim(), type: c.type }))
      .filter((c) => c.name);
    if (!name.trim() || cleanCols.length === 0) {
      toast({ title: 'Name and at least one column required', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      const t = await apiFetch<{ id: string; name: string }>('data-tables', {
        method: 'POST',
        body: { name: name.trim(), columns: cleanCols },
      });
      toast({ title: 'Created', description: t.name, variant: 'success' });
      router.push(`/data-tables/${t.id}`);
    } catch (e) {
      toast({ title: 'Create failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => router.push('/data-tables')} className="mb-2">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
      </Button>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Database className="h-7 w-7" /> New data table
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Supported column types: <code className="text-xs">string, number, date, boolean</code>
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label htmlFor="tname">Name</Label>
            <Input id="tname" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="customers" />
          </div>
          <div>
            <Label>Columns</Label>
            <div className="mt-1 space-y-2">
              {columns.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="name"
                    value={c.name}
                    onChange={(e) => {
                      const next = [...columns];
                      next[i] = { ...next[i], name: e.target.value };
                      setColumns(next);
                    }}
                    className="flex-1"
                  />
                  <Select
                    value={c.type}
                    onValueChange={(v) => {
                      const next = [...columns];
                      next[i] = { ...next[i], type: v as DataTableColumnType };
                      setColumns(next);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMN_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setColumns(columns.filter((_, j) => j !== i))}
                    disabled={columns.length === 1}
                    aria-label="Remove column"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setColumns([...columns, { name: '', type: 'string' }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add column
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={onSubmit} disabled={submitting}>
        <Save className="h-4 w-4 mr-1" /> Create table
      </Button>
    </div>
  );
}
