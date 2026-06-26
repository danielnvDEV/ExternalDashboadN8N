'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Database, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CursorPagination, useCursorPagination } from '@/components/data-table/pagination-cursor';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { relativeTime } from '@/lib/format';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type { DataTable, PaginatedResponse } from '@/lib/types';

export default function DataTablesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState('');

  const q = useCursorPagination<DataTable>('data-tables', { limit: 100, ...(name ? { filter: JSON.stringify({ name }) } : {}) }, {
    queryKey: [name],
  });

  const onDelete = async (t: DataTable) => {
    await apiFetch(`data-tables/${t.id}`, { method: 'DELETE' });
    q.refetch();
    toast({ title: 'Deleted', description: t.name });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Database className="h-7 w-7" /> Data Tables
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {q.data.length} table{q.data.length === 1 ? '' : 's'} on this page
          </p>
        </div>
        <Button onClick={() => router.push('/data-tables/new')}>
          <Plus className="h-4 w-4 mr-1" /> New table
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {q.isError ? (
            <PageError error={q.error} />
          ) : q.isLoading ? (
            <Skeleton className="h-32" />
          ) : q.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data tables yet.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell w-32">Columns</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell w-40">Project</th>
                    <th className="text-left p-2 font-medium hidden lg:table-cell w-32">Updated</th>
                    <th className="w-8 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((t) => (
                    <tr key={t.id} className="border-t hover:bg-muted/30">
                      <td className="p-2">
                        <button
                          onClick={() => router.push(`/data-tables/${t.id}`)}
                          className="text-left hover:underline font-medium"
                        >
                          {t.name}
                        </button>
                      </td>
                      <td className="p-2 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {t.columns.slice(0, 4).map((c) => (
                            <Badge key={c.id ?? c.name} variant="outline" className="text-[10px] font-mono">
                              {c.name}:{c.type}
                            </Badge>
                          ))}
                          {t.columns.length > 4 && (
                            <Badge variant="muted" className="text-[10px]">+{t.columns.length - 4}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2 hidden md:table-cell text-xs text-muted-foreground">
                        {t.projectName ?? '-'}
                      </td>
                      <td className="p-2 hidden lg:table-cell text-xs text-muted-foreground">
                        {relativeTime(t.updatedAt)}
                      </td>
                      <td className="p-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/data-tables/${t.id}`)}>
                              Browse rows
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/data-tables/${t.id}/schema`)}>
                              Manage columns
                            </DropdownMenuItem>
                            <ConfirmDialog
                              trigger={
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                </DropdownMenuItem>
                              }
                              title={`Delete table "${t.name}"?`}
                              description="This will permanently delete the table and all its rows."
                              confirmText="Delete"
                              onConfirm={() => onDelete(t)}
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
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
    </div>
  );
}
