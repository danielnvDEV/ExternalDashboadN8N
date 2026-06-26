'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Shield, User as UserIcon, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CodeViewer } from '@/components/code-viewer';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import { absoluteTime, relativeTime } from '@/lib/format';
import type { User, UserRole } from '@/lib/types';
import { EnterpriseGuard } from '@/components/enterprise-guard';

export default function UsersPage() {
  const { toast } = useToast();
  const [includeRole, setIncludeRole] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmails, setInviteEmails] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<UserRole>('global:member');
  const [detailUser, setDetailUser] = React.useState<User | null>(null);
  const [roleChange, setRoleChange] = React.useState<UserRole>('global:member');

  const q = useQuery<{ data: User[]; nextCursor: string | null }>({
    queryKey: ['n8n-users', includeRole],
    queryFn: () => apiFetch('users', { query: { limit: 100, includeRole } }),
  });

  const onInvite = async () => {
    const emails = inviteEmails.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (emails.length === 0) return;
    try {
      const r = await apiFetch<{ user?: User; error?: string }[]>('users', {
        method: 'POST',
        body: emails.map((email) => ({ email, role: inviteRole })),
      });
      const failed = r.filter((x) => x.error);
      toast({
        title: `Invited ${r.length - failed.length}/${r.length}`,
        description: failed.map((f) => `${f.user?.email}: ${f.error}`).join('; '),
        variant: failed.length ? 'destructive' : 'success',
      });
      setInviteOpen(false);
      setInviteEmails('');
      q.refetch();
    } catch (e) {
      toast({ title: 'Invite failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onDelete = async (u: User) => {
    await apiFetch(`users/${u.id}`, { method: 'DELETE' });
    q.refetch();
    toast({ title: 'Deleted', description: u.email });
  };

  const onChangeRole = async () => {
    if (!detailUser) return;
    try {
      await apiFetch(`users/${detailUser.id}/role`, {
        method: 'PATCH',
        body: { newRoleName: roleChange },
      });
      toast({ title: 'Role updated', variant: 'success' });
      setDetailUser(null);
      q.refetch();
    } catch (e) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const filtered = q.data?.data.filter((u) => !search || u.email.toLowerCase().includes(search.toLowerCase())) ?? [];

  return (
    <EnterpriseGuard>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
              <Users className="h-7 w-7" /> Users
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Enterprise / RBAC only. {q.data?.data.length ?? 0} user{q.data?.data.length === 1 ? '' : 's'} on this page
            </p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Invite user
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Filter by email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox checked={includeRole} onCheckedChange={(v) => setIncludeRole(!!v)} />
                Include role
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {q.isError ? (
              <PageError error={q.error} />
            ) : q.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="text-left p-2 font-medium">Email</th>
                      <th className="text-left p-2 font-medium hidden sm:table-cell w-40">Name</th>
                      <th className="text-left p-2 font-medium w-32">Role</th>
                      <th className="text-left p-2 font-medium hidden md:table-cell w-32">Status</th>
                      <th className="w-8 p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id} className="border-t hover:bg-muted/30">
                        <td className="p-2 font-mono text-xs">{u.email}</td>
                        <td className="p-2 hidden sm:table-cell text-xs">
                          {[u.firstName, u.lastName].filter(Boolean).join(' ') || '-'}
                        </td>
                        <td className="p-2">
                          {u.role ? (
                            <Badge variant="secondary" className="font-mono text-[10px]">{u.role}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        <td className="p-2 hidden md:table-cell text-xs text-muted-foreground">
                          {u.isPending ? 'pending' : 'active'}
                        </td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => { setDetailUser(u); setRoleChange(u.role ?? 'global:member'); }}>
                            <Shield className="h-3.5 w-3.5" />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button size="sm" variant="ghost" className="text-destructive">×</Button>
                            }
                            title={`Delete user "${u.email}"?`}
                            description="They will lose access immediately."
                            confirmText="Delete"
                            onConfirm={() => onDelete(u)}
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

        {/* Invite dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite user(s)</DialogTitle>
              <DialogDescription>One email per line, or comma-separated.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Emails</Label>
              <Input value={inviteEmails} onChange={(e) => setInviteEmails(e.target.value)} placeholder="alice@acme.com, bob@acme.com" />
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global:member">global:member</SelectItem>
                  <SelectItem value="global:admin">global:admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={onInvite} disabled={!inviteEmails.trim()}>Send invites</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail dialog */}
        <Dialog open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> User detail</DialogTitle>
            </DialogHeader>
            {detailUser && (
              <div className="space-y-2">
                <CodeViewer data={detailUser} maxHeight="240px" showCopy={false} />
                <p className="text-xs text-muted-foreground">Created {relativeTime(detailUser.createdAt)} · {absoluteTime(detailUser.createdAt)}</p>
                <Label>Change role</Label>
                <Select value={roleChange} onValueChange={(v) => setRoleChange(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global:member">global:member</SelectItem>
                    <SelectItem value="global:admin">global:admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailUser(null)}>Cancel</Button>
              <Button onClick={onChangeRole}>Update role</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EnterpriseGuard>
  );
}
