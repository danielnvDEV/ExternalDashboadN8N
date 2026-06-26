'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageError } from '@/components/capability-gate';
import { SaveFolderPicker } from '@/components/backup/save-folder-picker';
import { BackupPathsEditor } from '@/components/backup/backup-paths-editor';
import { BulkExport, type BulkExportEntry } from '@/components/backup/bulk-export';
import { getBackupPaths, resolveFinalPaths } from '@/lib/backup-paths';
import { useInternalFolderData } from '@/lib/use-internal-folders';
import type { FileSystemDirectoryHandle } from '@/lib/fs-access';
import type { PaginatedResponse, Workflow } from '@/lib/types';

export default function BackupPage() {
  const [paths, setPaths] = React.useState<Record<string, string>>({});
  const [folderSignal, setFolderSignal] = React.useState(0);

  const workflows = useQuery<PaginatedResponse<Workflow>>({
    queryKey: ['n8n-backup-workflows'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Workflow>>('workflows', {
        query: { limit: 250, excludePinnedData: true },
      }),
  });

  const folderData = useInternalFolderData();

  // Re-read stored paths every time the workflows query re-resolves.
  React.useEffect(() => {
    setPaths(getBackupPaths());
  }, [workflows.dataUpdatedAt]);

  const list = React.useMemo(() => workflows.data?.data ?? [], [workflows.data]);

  const { entries, duplicates } = React.useMemo(() => {
    const resolved = resolveFinalPaths(
      list.map((w) => {
        const fid = folderData.workflowFolderId.get(w.id);
        const folder = fid ? folderData.folderInfo.get(fid) : undefined;
        return {
          id: w.id,
          name: w.name,
          folderPath: folder?.path ?? null,
        };
      }),
      paths,
    );
    const out: BulkExportEntry[] = list.map((w) => ({
      id: w.id,
      name: w.name || w.id,
      path: resolved.paths[w.id] ?? `${w.id}.json`,
    }));
    return { entries: out, duplicates: resolved.duplicates };
  }, [list, paths, folderData.workflowFolderId, folderData.folderInfo]);

  // Bump signal when picker reports a handle change so BulkExport re-probes.
  const onHandleChange = React.useCallback((_h: FileSystemDirectoryHandle | null) => {
    setFolderSignal((s) => s + 1);
  }, []);

  if (workflows.isError) return <PageError error={workflows.error} />;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Backup</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Respalda todos tus workflows como archivos JSON. Elige una carpeta de destino y personaliza las rutas por workflow.
        </p>
      </div>

      <SaveFolderPicker onHandleChange={onHandleChange} />

      <BackupPathsEditor
        workflows={list.map((w) => {
          const fid = folderData.workflowFolderId.get(w.id);
          const folder = fid ? folderData.folderInfo.get(fid) : undefined;
          return {
            id: w.id,
            name: w.name,
            folderPath: folder?.path ?? null,
          };
        })}
        resetSignal={folderSignal}
      />

      {duplicates.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-yellow-700 dark:text-yellow-300" />
          <div>
            <p className="font-medium">{duplicates.length} ruta{duplicates.length === 1 ? '' : 's'} duplicada{duplicates.length === 1 ? '' : 's'} renombrada{duplicates.length === 1 ? '' : 's'} automáticamente.</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {duplicates.slice(0, 5).map((d) => (
                <li key={d.workflowId}>
                  <span className="font-mono">{d.original}</span> → <span className="font-mono">{d.renamed}</span>
                </li>
              ))}
              {duplicates.length > 5 && <li>… y {duplicates.length - 5} más.</li>}
            </ul>
          </div>
        </div>
      )}

      <BulkExport entries={entries} folderSignal={folderSignal} />

      {workflows.data?.nextCursor && (
        <p className="text-xs text-muted-foreground">
          Hay más workflows en n8n de los que esta vista muestra (límite 250). Aplica filtros en /workflows para acotar.
        </p>
      )}
    </div>
  );
}
