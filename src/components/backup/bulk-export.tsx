'use client';

import * as React from 'react';
import { CheckCircle2, Download, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadBlob } from '@/lib/download';
import { formatBytes } from '@/lib/format';
import {
  type FileSystemDirectoryHandle,
  ensurePermission,
  getBaseDirectory,
  writeJsonToBase,
} from '@/lib/fs-access';

interface WorkflowLite {
  id: string;
  name?: string | null;
}

export interface BulkExportEntry {
  id: string;
  name: string;
  /** Resolved relative path (default or custom, dedupe-suffixed when needed). */
  path: string;
}

interface ProgressRow {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'ok' | 'error';
  size?: number;
  message?: string;
}

interface BulkExportProps {
  entries: BulkExportEntry[];
  /** Bumped by the parent when the saved folder changes (so we re-read). */
  folderSignal?: number;
}

type Mode = 'unknown' | 'fsa' | 'fallback';

export function BulkExport({ entries, folderSignal = 0 }: BulkExportProps) {
  const [mode, setMode] = React.useState<Mode>('unknown');
  const [rows, setRows] = React.useState<ProgressRow[]>([]);
  const [running, setRunning] = React.useState(false);
  const [aborted, setAborted] = React.useState(false);
  const abortRef = React.useRef<boolean>(false);

  // Probe handle whenever folder picker reports a change.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const handle = await getBaseDirectory();
        if (cancelled) return;
        if (handle) {
          const granted = await ensurePermission(handle, 'readwrite');
          if (cancelled) return;
          setMode(granted ? 'fsa' : 'fallback');
        } else {
          setMode('fallback');
        }
      } catch {
        if (!cancelled) setMode('fallback');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folderSignal]);

  const resetRows = (which: 'all' | 'failed', prev: ProgressRow[]) => {
    if (which === 'all') return [];
    return prev.map((r) => (r.status === 'error' ? { ...r, status: 'pending', message: undefined } : r));
  };

  const start = async (which: 'all' | 'failed') => {
    if (entries.length === 0) return;
    setRunning(true);
    abortRef.current = false;
    setAborted(false);

    const baseRows: ProgressRow[] = which === 'all'
      ? entries.map((e) => ({ id: e.id, name: e.name, path: e.path, status: 'pending' as const }))
      : (() => {
          const existing = rows.length > 0 ? rows : entries.map((e) => ({ id: e.id, name: e.name, path: e.path, status: 'pending' as const }));
          return existing.map((r) => (r.status === 'error' ? { ...r, status: 'pending' as const, message: undefined } : r));
        })();

    setRows(baseRows);

    const baseHandle = mode === 'fsa' ? await getBaseDirectory() : null;
    if (mode === 'fsa' && baseHandle) {
      const granted = await ensurePermission(baseHandle, 'readwrite');
      if (!granted) {
        setMode('fallback');
      }
    }
    const effectiveMode: Mode = baseHandle && mode === 'fsa' ? 'fsa' : 'fallback';

    for (let i = 0; i < baseRows.length; i++) {
      if (abortRef.current) break;
      const target = baseRows[i];
      if (target.status === 'ok') continue; // skip already-ok rows when retrying failures

      setRows((prev) => prev.map((r) => (r.id === target.id ? { ...r, status: 'pending', message: undefined } : r)));

      try {
        const size = await exportOne(target, effectiveMode === 'fsa' ? baseHandle : null);
        setRows((prev) =>
          prev.map((r) => (r.id === target.id ? { ...r, status: 'ok', size } : r)),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setRows((prev) =>
          prev.map((r) => (r.id === target.id ? { ...r, status: 'error', message } : r)),
        );
      }

      if (effectiveMode === 'fallback') {
        // Browsers throttle parallel downloads — keep them sequential with a small gap.
        await new Promise((r) => setTimeout(r, 120));
      } else {
        // Yield to the event loop so the UI can repaint between writes.
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    setRunning(false);
    if (abortRef.current) setAborted(true);
  };

  const onAbort = () => {
    abortRef.current = true;
  };

  const okCount = rows.filter((r) => r.status === 'ok').length;
  const errCount = rows.filter((r) => r.status === 'error').length;
  const pendingCount = rows.filter((r) => r.status === 'pending').length;
  const doneCount = rows.length > 0 ? okCount + errCount : 0;
  const percent = rows.length === 0 ? 0 : Math.round((doneCount / rows.length) * 100);

  const hasFailed = errCount > 0;
  const noFolder = mode === 'fallback' && rows.length === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <CardTitle className="text-base">Descarga masiva</CardTitle>
            <Badge variant={mode === 'fsa' ? 'success' : 'muted'} className="text-[10px]">
              {mode === 'fsa' ? 'Escritura directa' : mode === 'fallback' ? 'Descarga por archivo' : 'Detectando…'}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">{entries.length} workflow{entries.length === 1 ? '' : 's'}</span>
        </div>
        <CardDescription>
          {mode === 'fsa'
            ? 'Se escribirán los JSON directamente en la carpeta seleccionada.'
            : 'Se abrirá el diálogo "Guardar como" del navegador para cada archivo.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => start('all')} disabled={running || entries.length === 0}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            {running ? 'Exportando…' : 'Descargar todos los workflows'}
          </Button>
          {hasFailed && !running && (
            <Button variant="outline" onClick={() => start('failed')} disabled={running}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reintentar fallidos ({errCount})
            </Button>
          )}
          {running && (
            <Button variant="ghost" onClick={onAbort}>
              Detener
            </Button>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay workflows para respaldar.</p>
        ) : noFolder ? null : (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Progreso: {doneCount} / {rows.length}
                </span>
                <span>{percent}%</span>
              </div>
              <Progress value={percent} />
            </div>

            {rows.length > 0 && (
              <div className="rounded-md border max-h-[360px] overflow-y-auto divide-y">
                {rows.map((r) => (
                  <ProgressLine key={r.id} row={r} />
                ))}
              </div>
            )}

            {aborted && (
              <p className="text-xs text-muted-foreground">Exportación detenida. Puedes reintentar los pendientes.</p>
            )}
            {pendingCount === 0 && rows.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {okCount} ok{errCount > 0 ? `, ${errCount} con error` : ''}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressLine({ row }: { row: ProgressRow }) {
  const Icon =
    row.status === 'pending' ? Loader2 : row.status === 'ok' ? CheckCircle2 : XCircle;
  const color =
    row.status === 'pending'
      ? 'text-muted-foreground'
      : row.status === 'ok'
        ? 'text-green-600 dark:text-green-400'
        : 'text-destructive';
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${color} ${row.status === 'pending' ? 'animate-spin' : ''}`} />
      <span className="flex-1 min-w-0 truncate">
        <span className="font-medium">{row.name || row.id}</span>
        <span className="text-muted-foreground ml-1.5 font-mono">{row.path}</span>
      </span>
      {row.status === 'ok' && row.size !== undefined && (
        <span className="text-muted-foreground font-mono">{formatBytes(row.size)}</span>
      )}
      {row.status === 'error' && (
        <span className="text-destructive truncate max-w-[40%]" title={row.message}>
          {row.message}
        </span>
      )}
    </div>
  );
}

async function exportOne(
  entry: BulkExportEntry,
  base: FileSystemDirectoryHandle | null,
): Promise<number> {
  const res = await fetch(`/api/n8n/workflows/${encodeURIComponent(entry.id)}?excludePinnedData=true`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) detail = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const data = await res.json();
  const json = JSON.stringify(data, null, 2);
  const size = new Blob([json]).size;

  if (base) {
    await writeJsonToBase(base, entry.path, data);
  } else {
    const filename = entry.path.split('/').pop() || `${entry.id}.json`;
    downloadBlob(filename, new Blob([json], { type: 'application/json' }));
  }

  return size;
}
