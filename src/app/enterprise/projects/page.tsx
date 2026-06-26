'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Folder, FolderCog, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CursorPagination, useCursorPagination } from '@/components/data-table/pagination-cursor';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import { relativeTime } from '@/lib/format';
import type { PaginatedResponse, Project } from '@/lib/types';
import { EnterpriseGuard } from '@/components/enterprise-guard';

export default function ProjectsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');

  const q = useCursorPagination<Project>('projects', { limit: 100, ...(name ? { name } : {}) }, {
    queryKey: [name],
  });

  const onCreate = async () => {
    if (!newName.trim()) return;
    try {
      await apiFetch<Project>('projects', { method: 'POST', body: { name: newName.trim() } });
      toast({ title: 'Project created', variant: 'success' });
      setNewName('');
      setCreateOpen(false);
      q.refetch();
    } catch (e) {
      toast({ title: 'Create failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onDelete = async (p: Project) => {
    await apiFetch(`projects/${p.id}`, { method: 'DELETE' });
    q.refetch();
    toast({ title: 'Deleted', description: p.name });
  };

  return (
    <EnterpriseGuard>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
              <FolderCog className="h-7 w-7" /> Projects
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Enterprise / RBAC only. {q.data.length} project{q.data.length === 1 ? '' : 's'} on this page
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New project
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filter by name…" value={name} onChange={(e) => setName(e.target.value)} className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            {q.isError ? (
              <PageError error={q.error} />
            ) : q.isLoading ? (
              <Skeleton className="h-32" />
            ) : q.data.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No projects yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {q.data.map((p) => (
                  <div key={p.id} className="rounded-md border bg-muted/20 p-3 flex flex-col gap-2">
                    <button
                      onClick={() => router.push(`/enterprise/projects/${p.id}`)}
                      className="text-left hover:underline font-medium flex items-center gap-1.5"
                    >
                      <Folder className="h-4 w-4" /> {p.name}
                    </button>
                    <div className="flex items-center justify-between text-xs">
                      {p.type && <Badge variant="muted">{p.type}</Badge>}
                      <span className="text-muted-foreground">
                        {p.updatedAt ? relativeTime(p.updatedAt) : ''}
                      </span>
                      <ConfirmDialog
                        trigger={
                          <Button size="icon" variant="ghost" aria-label="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        }
                        title={`Delete project "${p.name}"?`}
                        description="This will detach all workflows and credentials from the project."
                        confirmText="Delete"
                        onConfirm={() => onDelete(p)}
                      />
                    </div>
                  </div>
                ))}
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
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
            </DialogHeader>
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={onCreate} disabled={!newName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EnterpriseGuard>
  );
}
