'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { downloadBlob, safeFilename } from '@/lib/download';

interface DownloadJsonButtonProps {
  workflowId: string;
  workflowName: string;
}

export function DownloadJsonButton({ workflowId, workflowName }: DownloadJsonButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/n8n/workflows/${encodeURIComponent(workflowId)}`, {
        cache: 'no-store',
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({} as { message?: string; hint?: string }));
        throw new Error(err.message ?? `Request failed: ${r.status}`);
      }
      const data = await r.json();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const filename = `${safeFilename(workflowName, workflowId)}.json`;
      downloadBlob(filename, blob);
      toast({ title: 'Downloaded', description: filename, variant: 'success' });
    } catch (e) {
      toast({
        title: 'Download failed',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
      <Download className="h-3.5 w-3.5 mr-1" />
      {loading ? 'Downloading…' : 'Download JSON'}
    </Button>
  );
}