'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FolderCog, Plus, Trash2, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CodeViewer } from '@/components/code-viewer';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type { Folder, Project, ProjectMember, User } from '@/lib/types';
import { EnterpriseGuard } from '@/components/enterprise-guard';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const projectId = params.id;

  const projectQ = useQuery<Project>({
    queryKey: ['n8n-project', projectId],
    queryFn: () => apiFetch(`projects/${projectId}`),
  });

  const membersQ = useQuery<{ data: ProjectMember[]; nextCursor: string | null }>({
    queryKey: ['n8n-project-members', projectId],
    queryFn: () => apiFetch(`projects/${projectId}/users`, { query: { limit: 100 } }),
  });

  const foldersQ = useQuery<{ count: number; data: Folder[] }>({
    queryKey: ['n8n-project-folders', projectId],
    queryFn: () => apiFetch(`projects/${projectId}/folders`, { query: { take: 100 } }),
  });

  const usersQ = useQuery<{ data: User[]; nextCursor: string | null }>({
    queryKey: ['n8n-users-for-project'],
    queryFn: () => apiFetch('users', { query: { limit: 250 } }),
  });

  const [addMemberOpen, setAddMemberOpen] = React.useState(false);
  const [newMemberUserId, setNewMemberUserId] = React.useState('');
  const [newMemberRole, setNewMemberRole] = React.useState<'project:editor' | 'project:viewer'>('project:viewer');
  const [addFolderOpen, setAddFolderOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');

  const onAddMember = async () => {
    if (!newMemberUserId) return;
    try {
      await apiFetch(`projects/${projectId}/users`, {
        method: 'POST',
        body: { relations: [{ userId: newMemberUserId, role: newMemberRole }] },
      });
      toast({ title: 'Member added', variant: 'success' });
      setAddMemberOpen(false);
      setNewMemberUserId('');
      membersQ.refetch();
    } catch (e) {
      toast({ title: 'Add failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onRemoveMember = async (m: ProjectMember) => {
    await apiFetch(`projects/${projectId}/users/${m.id}`, { method: 'DELETE' });
    membersQ.refetch();
    toast({ title: 'Member removed', description: m.email });
  };

  const onChangeRole = async (m: ProjectMember, role: 'project:editor' | 'project:viewer') => {
    try {
      await apiFetch(`projects/${projectId}/users/${m.id}`, { method: 'PATCH', body: { role } });
      membersQ.refetch();
      toast({ title: 'Role updated', variant: 'success' });
    } catch (e) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onAddFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await apiFetch(`projects/${projectId}/folders`, { method: 'POST', body: { name: newFolderName.trim() } });
      toast({ title: 'Folder created', variant: 'success' });
      setAddFolderOpen(false);
      setNewFolderName('');
      foldersQ.refetch();
    } catch (e) {
      toast({ title: 'Create failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  if (projectQ.isLoading) return <Skeleton className="h-32" />;
  if (projectQ.isError) return <PageError error={projectQ.error} />;
  if (!projectQ.data) return null;
  const p = projectQ.data;

  return (
    <EnterpriseGuard>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/enterprise/projects')} className="mb-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FolderCog className="h-6 w-6" /> {p.name}
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">{p.id}</p>
        </div>

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members ({membersQ.data?.data.length ?? 0})</TabsTrigger>
            <TabsTrigger value="folders">Folders ({foldersQ.data?.data.length ?? 0})</TabsTrigger>
            <TabsTrigger value="meta">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Members</CardTitle>
                    <CardDescription>Users assigned to this project and their role.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Add member
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {membersQ.isLoading ? (
                  <Skeleton className="h-24" />
                ) : !membersQ.data?.data.length ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs">
                        <tr>
                          <th className="text-left p-2 font-medium">Email</th>
                          <th className="text-left p-2 font-medium w-40">Role</th>
                          <th className="w-8 p-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {membersQ.data.data.map((m) => (
                          <tr key={m.id} className="border-t">
                            <td className="p-2 font-mono text-xs">{m.email}</td>
                            <td className="p-2">
                              <Select
                                value={m.role}
                                onValueChange={(v) => onChangeRole(m, v as 'project:editor' | 'project:viewer')}
                              >
                                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="project:viewer">project:viewer</SelectItem>
                                  <SelectItem value="project:editor">project:editor</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2 text-right">
                              <ConfirmDialog
                                trigger={<Button size="icon" variant="ghost" aria-label="Remove"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                                title={`Remove ${m.email}?`}
                                description="They will lose access to this project."
                                confirmText="Remove"
                                onConfirm={() => onRemoveMember(m)}
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
          </TabsContent>

          <TabsContent value="folders">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Folders</CardTitle>
                    <CardDescription>Organize workflows in this project.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setAddFolderOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> New folder
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {foldersQ.isLoading ? (
                  <Skeleton className="h-24" />
                ) : !foldersQ.data?.data.length ? (
                  <p className="text-sm text-muted-foreground">No folders.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {foldersQ.data.data.map((f) => (
                      <div key={f.id} className="rounded-md border bg-muted/20 p-3">
                        <div className="font-medium">{f.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 flex gap-2">
                          <Badge variant="muted" className="text-[10px]">wf: {f.workflowCount ?? f.totalWorkflows ?? '?'}</Badge>
                          <Badge variant="muted" className="text-[10px]">sub: {f.subFolderCount ?? f.totalSubFolders ?? '?'}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meta">
            <Card>
              <CardContent className="pt-6">
                <CodeViewer data={p} maxHeight="400px" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add member dialog */}
        <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={newMemberUserId} onValueChange={setNewMemberUserId}>
                <SelectTrigger><SelectValue placeholder="Choose user…" /></SelectTrigger>
                <SelectContent>
                  {usersQ.data?.data.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label>Role</Label>
              <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as 'project:editor' | 'project:viewer')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project:viewer">project:viewer</SelectItem>
                  <SelectItem value="project:editor">project:editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
              <Button onClick={onAddMember} disabled={!newMemberUserId}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addFolderOpen} onOpenChange={setAddFolderOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
            <div>
              <Label>Name</Label>
              <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="mt-1" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddFolderOpen(false)}>Cancel</Button>
              <Button onClick={onAddFolder} disabled={!newFolderName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EnterpriseGuard>
  );
}
