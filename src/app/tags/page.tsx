'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Edit, MoreHorizontal, Plus, Search, Tag as TagIcon, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CursorPagination, useCursorPagination } from '@/components/data-table/pagination-cursor';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type { PaginatedResponse, Tag } from '@/lib/types';

export default function TagsPage() {
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [editTarget, setEditTarget] = React.useState<Tag | null>(null);
  const [editName, setEditName] = React.useState('');

  const q = useCursorPagination<Tag>('tags', { limit: 100, ...(name ? { name } : {}) }, {
    queryKey: [name],
  });

  const onCreate = async () => {
    if (!newName.trim()) return;
    try {
      const t = await apiFetch<Tag>('tags', { method: 'POST', body: { name: newName.trim() } });
      toast({ title: 'Created', description: t.name, variant: 'success' });
      setNewName('');
      setCreateOpen(false);
      q.refetch();
    } catch (e) {
      toast({ title: 'Create failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onUpdate = async () => {
    if (!editTarget || !editName.trim()) return;
    try {
      await apiFetch(`tags/${editTarget.id}`, { method: 'PUT', body: { name: editName.trim() } });
      toast({ title: 'Updated', variant: 'success' });
      setEditTarget(null);
      q.refetch();
    } catch (e) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onDelete = async (t: Tag) => {
    await apiFetch(`tags/${t.id}`, { method: 'DELETE' });
    q.refetch();
    toast({ title: 'Deleted', description: t.name });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <TagIcon className="h-7 w-7" /> Tags
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {q.data.length} tag{q.data.length === 1 ? '' : 's'} on this page
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New tag
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
            <p className="text-sm text-muted-foreground py-8 text-center">No tags yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {q.data.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2"
                >
                  <Badge variant="secondary" className="font-mono text-xs">{t.name}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditTarget(t);
                          setEditName(t.name);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5 mr-2" /> Rename
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
                        title={`Delete tag "${t.name}"?`}
                        description="This will remove the tag from all workflows and executions."
                        confirmText="Delete"
                        onConfirm={() => onDelete(t)}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
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
            <DialogTitle>New tag</DialogTitle>
            <DialogDescription>Tags can be assigned to workflows and executions.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="production"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={onCreate} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename tag</DialogTitle>
          </DialogHeader>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onUpdate()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={onUpdate} disabled={!editName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
