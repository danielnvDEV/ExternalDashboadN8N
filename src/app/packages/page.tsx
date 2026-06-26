'use client';

import * as React from 'react';
import { Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { CodeViewer } from '@/components/code-viewer';

export default function PackagesIndexPage() {
  const { toast } = useToast();
  const [envInfo, setEnvInfo] = React.useState<unknown>(null);

  React.useEffect(() => {
    // The /n8n-packages/* endpoints are Beta; just probe discover to confirm availability.
    fetch('/api/n8n/discover', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setEnvInfo(d))
      .catch(() => setEnvInfo({ error: 'Could not check' }));
  }, []);

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Package className="h-7 w-7" /> n8n Packages
          <span className="text-xs font-normal rounded bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 ml-1">
            Beta
          </span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Import/export entire workflows + credentials as a single <code className="text-xs">.n8np</code> archive.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
            <CardDescription>Download a .n8np archive of selected workflows and their credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/packages/export">Open export</a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import</CardTitle>
            <CardDescription>Upload a .n8np archive and choose conflict policies.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/packages/import">Open import</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Availability</CardTitle>
          <CardDescription>
            The n8n Packages feature is in beta. Your n8n instance must have{' '}
            <code className="text-xs">N8N_PUBLIC_API_PACKAGES_ENABLED=true</code> set and the n8n Packages feature
            license enabled. If you see 404 below, the feature is disabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeViewer data={envInfo} maxHeight="400px" showCopy={false} />
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const r = await fetch('/api/n8n/n8n-packages/export', { method: 'POST' });
                if (r.status === 404) {
                  toast({ title: 'Packages API not available', description: 'Enable N8N_PUBLIC_API_PACKAGES_ENABLED', variant: 'destructive' });
                } else {
                  toast({ title: 'Endpoint reachable', description: `Status ${r.status}` });
                }
              } catch (e) {
                toast({ title: 'Probe failed', description: (e as Error).message, variant: 'destructive' });
              }
            }}
          >
            Probe /n8n-packages/export
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
