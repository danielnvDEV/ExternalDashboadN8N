'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Package, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageError } from '@/components/capability-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import { formatNumber } from '@/lib/format';
import type { CommunityPackage } from '@/lib/types';

export default function CommunityPackagesPage() {
  const { toast } = useToast();
  const q = useQuery<CommunityPackage[]>({
    queryKey: ['n8n-community-packages'],
    queryFn: () => apiFetch('community-packages'),
  });

  const [installOpen, setInstallOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [version, setVersion] = React.useState('');
  const [verify, setVerify] = React.useState(true);

  const onInstall = async () => {
    if (!name.trim()) return;
    try {
      await apiFetch('community-packages', {
        method: 'POST',
        body: { name: name.trim(), version: version.trim() || undefined, verify },
      });
      toast({ title: 'Installed', description: name, variant: 'success' });
      setInstallOpen(false);
      setName('');
      setVersion('');
      q.refetch();
    } catch (e) {
      toast({ title: 'Install failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onUpdate = async (pkg: CommunityPackage) => {
    try {
      await apiFetch(`community-packages/${encodeURIComponent(pkg.packageName)}`, {
        method: 'PATCH',
        body: { verify: true },
      });
      toast({ title: 'Updated', description: pkg.packageName, variant: 'success' });
      q.refetch();
    } catch (e) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onUninstall = async (pkg: CommunityPackage) => {
    await apiFetch(`community-packages/${encodeURIComponent(pkg.packageName)}`, {
      method: 'DELETE',
    });
    toast({ title: 'Uninstalled', description: pkg.packageName });
    q.refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7" /> Community packages
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Install community-built n8n nodes from npm.
          </p>
        </div>
        <Button onClick={() => setInstallOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Install
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {q.isError ? (
            <PageError error={q.error} />
          ) : q.isLoading ? (
            <Skeleton className="h-32" />
          ) : !q.data?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No community packages installed.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left p-2 font-medium">Package</th>
                    <th className="text-left p-2 font-medium w-32">Installed</th>
                    <th className="text-left p-2 font-medium w-32">Update</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell w-32">Downloads</th>
                    <th className="w-8 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((p) => (
                    <tr key={p.packageName} className="border-t hover:bg-muted/30">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{p.packageName}</span>
                          {p.failedLoading && <Badge variant="destructive" className="text-[10px]">failed</Badge>}
                        </div>
                      </td>
                      <td className="p-2 font-mono text-xs">{p.installedVersion}</td>
                      <td className="p-2">
                        {p.updateAvailable ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="info" className="text-[10px] font-mono">{p.updateAvailable}</Badge>
                            <Button size="sm" variant="outline" onClick={() => onUpdate(p)}>
                              <Upload className="h-3 w-3 mr-1" /> Update
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">up-to-date</span>
                        )}
                      </td>
                      <td className="p-2 hidden md:table-cell text-xs text-muted-foreground">
                        {formatNumber(p.packageVersion?.totalDownloads ?? 0)}
                      </td>
                      <td className="p-2 text-right">
                        <ConfirmDialog
                          trigger={
                            <Button size="icon" variant="ghost" aria-label="Uninstall">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          }
                          title={`Uninstall "${p.packageName}"?`}
                          description="Any workflow using this node will fail."
                          confirmText="Uninstall"
                          onConfirm={() => onUninstall(p)}
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

      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install community package</DialogTitle>
            <DialogDescription>
              Provide the npm package name (e.g. <code className="text-xs">n8n-nodes-evolution-api</code>).{' '}
              Verification checks the package against n8n&apos;s vetted list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Package name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="n8n-nodes-example" />
            <Label>Version (optional)</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="latest" />
            <label className="flex items-center gap-2 text-sm mt-2">
              <Checkbox checked={verify} onCheckedChange={(v) => setVerify(!!v)} />
              <ShieldCheck className="h-3.5 w-3.5" /> Verify against n8n vetted list (recommended)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallOpen(false)}>Cancel</Button>
            <Button onClick={onInstall} disabled={!name.trim()}>Install</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
