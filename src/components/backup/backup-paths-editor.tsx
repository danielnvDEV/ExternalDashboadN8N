'use client';

import * as React from 'react';
import { Pencil, RotateCcw, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  defaultBackupPath,
  defaultBackupPathFor,
  getBackupPaths,
  setBackupPath,
  validateBackupPath,
} from '@/lib/backup-paths';
import { truncate } from '@/lib/format';

interface WorkflowLite {
  id: string;
  name?: string | null;
  /** Folder hierarchy path (slash-separated) for folder-aware defaults. */
  folderPath?: string | null;
}

interface BackupPathsEditorProps {
  workflows: WorkflowLite[];
  /** Bumped by the parent when something external invalidates the stored map. */
  resetSignal?: number;
}

interface RowState {
  draft: string;
  error: string | null;
  /** True while the row is focused for editing. Suppresses re-renders that overwrite the draft. */
  editing: boolean;
}

export function BackupPathsEditor({ workflows, resetSignal = 0 }: BackupPathsEditorProps) {
  const [paths, setPaths] = React.useState<Record<string, string>>(() => getBackupPaths());
  const [query, setQuery] = React.useState('');
  const rowsRef = React.useRef<Map<string, RowState>>(new Map());
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    setPaths(getBackupPaths());
    rowsRef.current.clear();
  }, [resetSignal]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter((wf) => {
      const stored = paths[wf.id] || defaultBackupPathFor(wf.name, wf.id, wf.folderPath);
      return (
        (wf.name ?? '').toLowerCase().includes(q) ||
        wf.id.toLowerCase().includes(q) ||
        stored.toLowerCase().includes(q)
      );
    });
  }, [workflows, paths, query]);

  const writeRow = (id: string, raw: string, error: string | null) => {
    setPaths((prev) => {
      const next = { ...prev };
      if (error || raw === '') {
        delete next[id];
      } else {
        next[id] = raw;
      }
      return next;
    });
    setBackupPath(id, error ? '' : raw);
  };

  const handleReset = (wf: WorkflowLite) => {
    rowsRef.current.delete(wf.id);
    setPaths((prev) => {
      if (!(wf.id in prev)) return prev;
      const next = { ...prev };
      delete next[wf.id];
      return next;
    });
    setBackupPath(wf.id, '');
    force();
  };

  const customizedCount = workflows.filter((w) => paths[w.id]).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            <CardTitle className="text-base">Rutas por workflow</CardTitle>
            {customizedCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {customizedCount} personalizadas
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Vacío → default <code className="font-mono">safe-name.json</code>
          </span>
        </div>
        <CardDescription>
          Cada workflow se escribirá en su carpeta relativa. Click en una celda para editar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, id o ruta…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="rounded-md border">
          <div className="grid grid-cols-[1fr_2fr_auto] items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
            <span>Workflow</span>
            <span>Ruta relativa</span>
            <span className="w-9" />
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                {workflows.length === 0
                  ? 'No hay workflows para mostrar.'
                  : `Sin coincidencias para "${query}".`}
              </div>
            ) : (
              filtered.map((wf) => {
                const stored = paths[wf.id];
                const row = rowsRef.current.get(wf.id) ?? {
                  draft: stored ?? '',
                  error: null,
                  editing: false,
                };
                const fallback = defaultBackupPathFor(wf.name, wf.id, wf.folderPath);
                const displayValue = row.editing
                  ? row.draft
                  : (stored ?? '');
                const customized = !!stored;

                return (
                  <PathRow
                    key={wf.id}
                    workflow={wf}
                    fallback={fallback}
                    customized={customized}
                    value={displayValue}
                    error={row.error}
                    onFocus={() => {
                      rowsRef.current.set(wf.id, { ...row, editing: true });
                      force();
                    }}
                    onChange={(v) => {
                      rowsRef.current.set(wf.id, { ...row, draft: v, editing: true, error: null });
                      force();
                    }}
                    onBlur={() => {
                      const trimmed = row.draft.trim();
                      if (trimmed === '') {
                        // Treat empty as "use default" — clear stored override if any.
                        if (customized) {
                          rowsRef.current.set(wf.id, { draft: '', error: null, editing: false });
                          writeRow(wf.id, '', null);
                        } else {
                          rowsRef.current.set(wf.id, { draft: '', error: null, editing: false });
                        }
                        force();
                        return;
                      }
                      const result = validateBackupPath(trimmed);
                      if (!result.ok || !result.normalized) {
                        rowsRef.current.set(wf.id, {
                          draft: trimmed,
                          error: result.error ?? 'Invalid path',
                          editing: false,
                        });
                        force();
                        return;
                      }
                      if (result.normalized === fallback) {
                        // Saving the default = effectively "no override".
                        rowsRef.current.set(wf.id, {
                          draft: '',
                          error: null,
                          editing: false,
                        });
                        writeRow(wf.id, '', null);
                      } else {
                        rowsRef.current.set(wf.id, {
                          draft: result.normalized,
                          error: null,
                          editing: false,
                        });
                        writeRow(wf.id, result.normalized, null);
                      }
                      force();
                    }}
                    onReset={() => handleReset(wf)}
                  />
                );
              })
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Las rutas duplicadas se resuelven añadiendo automáticamente un sufijo <code>-&lt;id&gt;</code> al escribir.
        </p>
      </CardContent>
    </Card>
  );
}

interface PathRowProps {
  workflow: WorkflowLite;
  fallback: string;
  customized: boolean;
  value: string;
  error: string | null;
  onFocus: () => void;
  onChange: (v: string) => void;
  onBlur: () => void;
  onReset: () => void;
}

function PathRow({
  workflow,
  fallback,
  customized,
  value,
  error,
  onFocus,
  onChange,
  onBlur,
  onReset,
}: PathRowProps) {
  return (
    <div className="grid grid-cols-[1fr_2fr_auto] items-start gap-2 px-3 py-2 text-sm">
      <div className="min-w-0 pt-1.5">
        <div className="font-medium truncate" title={workflow.name ?? workflow.id}>
          {truncate(workflow.name || '(unnamed)', 40)}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground truncate">{workflow.id}</div>
      </div>
      <div className="min-w-0 space-y-1">
        <Input
          value={value}
          placeholder={fallback}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`h-8 text-xs font-mono ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          spellCheck={false}
          autoComplete="off"
        />
        {error ? (
          <p className="text-[11px] text-destructive">{error}</p>
        ) : !customized && value === '' ? (
          <p className="text-[11px] text-muted-foreground truncate">
            default: <code className="font-mono">{fallback}</code>
          </p>
        ) : null}
      </div>
      <div className="pt-1.5">
        {customized && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onReset}
            aria-label="Restablecer ruta"
            title="Restablecer ruta al default"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
