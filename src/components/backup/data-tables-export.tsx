'use client';

import * as React from 'react';
import { CheckCircle2, Database, Download, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiFetch } from '@/lib/api-client';
import { downloadBlob, safeFilename } from '@/lib/download';
import { formatBytes } from '@/lib/format';
import { CSV_BOM, deriveHeaders, rowsToCsv } from '@/lib/csv';
import {
  type FileSystemDirectoryHandle,
  ensurePermission,
  getBaseDirectory,
  writeTextToBase,
} from '@/lib/fs-access';
import type { DataTable, PaginatedResponse } from '@/lib/types';

/** Subfolder (inside the chosen base dir) where data-table CSVs are written. */
const CSV_SUBDIR = 'data-tables';
/** Page size used to walk a table's rows (n8n max is 250). */
const ROWS_PAGE = 250;

interface ProgressRow {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'ok' | 'error';
  rows?: number;
  size?: number;
  message?: string;
}

interface DataTablesExportProps {
  /** Bumped by the parent when the saved folder changes (so we re-read). */
  folderSignal?: number;
}

type Mode = 'unknown' | 'fsa' | 'fallback';

interface RowsResponse {
  data: Array<Record<string, unknown>>;
  nextCursor?: string | null;
}

export function DataTablesExport({ folderSignal = 0 }: DataTablesExportProps) {
  const [mode, setMode] = React.useState<Mode>('unknown');
  const [tables, setTables] = React.useState<DataTable[]>([]);
  const [loadingTables, setLoadingTables] = React.useState(true);
  const [rows, setRows] = React.useState<ProgressRow[]>([]);
  const [running, setRunning] = React.useState(false);
  const [aborted, setAborted] = React.useState(false);
  const abortRef = React.useRef(false);

  // Load the list of data tables once.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTables(true);
      try {
        const all: DataTable[] = [];
        let cursor: string | null = null;
        do {
          const res: PaginatedResponse<DataTable> = await apiFetch<PaginatedResponse<DataTable>>(
            'data-tables',
            { query: { limit: 100, ...(cursor ? { cursor } : {}) } },
          );
          all.push(...(res.data ?? []));
          cursor = res.nextCursor;
        } while (cursor && !cancelled);
        if (!cancelled) setTables(all);
      } catch {
        if (!cancelled) setTables([]);
      } finally {
        if (!cancelled) setLoadingTables(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Probe folder handle whenever the picker reports a change.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const handle = await getBaseDirectory();
        if (cancelled) return;
        if (handle) {
          const granted = await ensurePermission(handle, 'readwrite');
          if (!cancelled) setMode(granted ? 'fsa' : 'fallback');
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

  const start = async (which: 'all' | 'failed') => {
    if (tables.length === 0) return;
    setRunning(true);
    abortRef.current = false;
    setAborted(false);

    const baseRows: ProgressRow[] =
      which === 'all'
        ? tables.map((t) => ({
            id: t.id,
            name: t.name,
            path: `${CSV_SUBDIR}/${safeFilename(t.name, t.id)}.csv`,
            status: 'pending' as const,
          }))
        : (rows.length > 0 ? rows : tables.map((t) => ({
            id: t.id,
            name: t.name,
            path: `${CSV_SUBDIR}/${safeFilename(t.name, t.id)}.csv`,
            status: 'pending' as const,
          }))).map((r) => (r.status === 'error' ? { ...r, status: 'pending' as const, message: undefined } : r));

    setRows(baseRows);

    const baseHandle = mode === 'fsa' ? await getBaseDirectory() : null;
    if (mode === 'fsa' && baseHandle) {
      const granted = await ensurePermission(baseHandle, 'readwrite');
      if (!granted) setMode('fallback');
    }
    const effectiveMode: Mode = baseHandle && mode === 'fsa' ? 'fsa' : 'fallback';

    for (let i = 0; i < baseRows.length; i++) {
      if (abortRef.current) break;
      const target = baseRows[i];
      if (target.status === 'ok') continue;

      setRows((prev) => prev.map((r) => (r.id === target.id ? { ...r, status: 'pending', message: undefined } : r)));

      try {
        const table = tables.find((t) => t.id === target.id);
        const result = await exportTable(target, table, effectiveMode === 'fsa' ? baseHandle : null);
        setRows((prev) =>
          prev.map((r) => (r.id === target.id ? { ...r, status: 'ok', rows: result.rows, size: result.size } : r)),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setRows((prev) => prev.map((r) => (r.id === target.id ? { ...r, status: 'error', message } : r)));
      }

      // Browsers throttle parallel downloads; keep a small gap in fallback mode.
      await new Promise((r) => setTimeout(r, effectiveMode === 'fallback' ? 150 : 0));
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <CardTitle className="text-base">Data tables (CSV)</CardTitle>
            <Badge variant={mode === 'fsa' ? 'success' : 'muted'} className="text-[10px]">
              {mode === 'fsa' ? 'Escritura directa' : mode === 'fallback' ? 'Descarga por archivo' : 'Detectando…'}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {loadingTables ? 'Cargando…' : `${tables.length} tabla${tables.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <CardDescription>
          {mode === 'fsa'
            ? `Se escribirá un CSV por tabla en la subcarpeta "${CSV_SUBDIR}/" de la carpeta seleccionada.`
            : 'Se descargará un CSV por cada data table mediante el navegador.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => start('all')} disabled={running || loadingTables || tables.length === 0}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            {running ? 'Exportando…' : 'Exportar data tables a CSV'}
          </Button>
          {hasFailed && !running && (
            <Button variant="outline" onClick={() => start('failed')} disabled={running}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reintentar fallidas ({errCount})
            </Button>
          )}
          {running && (
            <Button variant="ghost" onClick={onAbort}>
              Detener
            </Button>
          )}
        </div>

        {!loadingTables && tables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay data tables para respaldar.</p>
        ) : rows.length === 0 ? null : (
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

            <div className="rounded-md border max-h-[360px] overflow-y-auto divide-y">
              {rows.map((r) => (
                <ProgressLine key={r.id} row={r} />
              ))}
            </div>

            {aborted && (
              <p className="text-xs text-muted-foreground">Exportación detenida. Puedes reintentar las pendientes.</p>
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
  const Icon = row.status === 'pending' ? Loader2 : row.status === 'ok' ? CheckCircle2 : XCircle;
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
      {row.status === 'ok' && (
        <span className="text-muted-foreground font-mono whitespace-nowrap">
          {row.rows ?? 0} fila{row.rows === 1 ? '' : 's'}
          {row.size !== undefined ? ` · ${formatBytes(row.size)}` : ''}
        </span>
      )}
      {row.status === 'error' && (
        <span className="text-destructive truncate max-w-[40%]" title={row.message}>
          {row.message}
        </span>
      )}
    </div>
  );
}

async function exportTable(
  entry: ProgressRow,
  table: DataTable | undefined,
  base: FileSystemDirectoryHandle | null,
): Promise<{ rows: number; size: number }> {
  // Walk every page of rows via cursor-based pagination (n8n: limit + cursor).
  const collected: Array<Record<string, unknown>> = [];
  let cursor: string | null = null;
  for (;;) {
    const res: RowsResponse = await apiFetch<RowsResponse>(
      `data-tables/${encodeURIComponent(entry.id)}/rows`,
      { query: { limit: ROWS_PAGE, ...(cursor ? { cursor } : {}) } },
    );
    const batch = res.data ?? [];
    collected.push(...batch);
    cursor = res.nextCursor ?? null;
    if (!cursor || batch.length === 0) break;
  }

  const headers = deriveHeaders((table?.columns ?? []).map((c) => c.name), collected);
  const csv = CSV_BOM + rowsToCsv(headers, collected);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  if (base) {
    await writeTextToBase(base, entry.path, csv);
  } else {
    const filename = entry.path.split('/').pop() || `${entry.id}.csv`;
    downloadBlob(filename, blob);
  }

  return { rows: collected.length, size: blob.size };
}
