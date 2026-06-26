'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Lock, MoreHorizontal, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CursorPagination, useCursorPagination } from '@/components/data-table/pagination-cursor';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { relativeTime } from '@/lib/format';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type { Credential, PaginatedResponse } from '@/lib/types';

export default function CredentialsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('');

  const params: Record<string, unknown> = { limit: 100 };
  if (name) params.name = name;
  if (type) params.type = type;

  const q = useCursorPagination<Credential>('credentials', params, {
    queryKey: [name, type],
  });

  const onTest = async (c: Credential) => {
    try {
      const r = await apiFetch<{ status?: string; message?: string }>(`credentials/${c.id}/test`, {
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

  const onDelete = async (c: Credential) => {
    await apiFetch(`credentials/${c.id}`, { method: 'DELETE' });
    q.refetch();
    toast({ title: 'Deleted', description: c.name, variant: 'success' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <KeyRound className="h-7 w-7" /> Credentials
          </h1>
          <p className="text-muted-foreground mt-1 text-sm flex items-center gap-1">
            <Lock className="h-3 w-3" /> Secret data is never returned by the API
          </p>
        </div>
        <Button onClick={() => router.push('/credentials/new')}>
          <Plus className="h-4 w-4 mr-1" /> New credential
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filter by name…" value={name} onChange={(e) => setName(e.target.value)} className="pl-8" />
            </div>
            <Input placeholder="Type (e.g. notionApi, slackApi)" value={type} onChange={(e) => setType(e.target.value)} className="w-60" />
          </div>
        </CardHeader>
        <CardContent>
          {q.isError ? (
            <PageError error={q.error} />
          ) : q.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : q.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No credentials found.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Type</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell w-40">Project</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell w-32">Updated</th>
                    <th className="w-8 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/credentials/${c.id}`)}
                          className="text-left hover:underline font-medium"
                        >
                          {c.name}
                        </button>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className="font-mono text-[10px]">{c.type}</Badge>
                      </td>
                      <td className="p-2 hidden md:table-cell text-xs text-muted-foreground truncate">
                        {c.homeProject?.name ?? '-'}
                      </td>
                      <td className="p-2 hidden sm:table-cell text-xs text-muted-foreground">{relativeTime(c.updatedAt)}</td>
                      <td className="p-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onTest(c)}>
                              <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Test
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/credentials/${c.id}`)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <ConfirmDialog
                              trigger={
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                </DropdownMenuItem>
                              }
                              title={`Delete "${c.name}"?`}
                              description="This will permanently remove the credential."
                              confirmText="Delete"
                              onConfirm={() => onDelete(c)}
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
