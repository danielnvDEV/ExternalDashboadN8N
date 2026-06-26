'use client';

import * as React from 'react';
import { Folder, FolderOpen, Info, RefreshCw, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type FileSystemDirectoryHandle,
  clearBaseDirectory,
  describeBaseDir,
  ensurePermission,
  getBaseDirectory,
  isFsAccessSupported,
  pickBaseDirectory,
} from '@/lib/fs-access';

interface SaveFolderPickerProps {
  /** Notified whenever the stored handle changes so siblings can re-read it. */
  onHandleChange?: (handle: FileSystemDirectoryHandle | null) => void;
}

type ProbeState =
  | { kind: 'loading' }
  | { kind: 'unsupported' }
  | { kind: 'empty' }
  | { kind: 'ready'; handle: FileSystemDirectoryHandle; label: string; granted: boolean };

export function SaveFolderPicker({ onHandleChange }: SaveFolderPickerProps) {
  const [state, setState] = React.useState<ProbeState>({ kind: 'loading' });
  const [busy, setBusy] = React.useState(false);

  const probe = React.useCallback(async () => {
    if (!isFsAccessSupported()) {
      setState({ kind: 'unsupported' });
      onHandleChange?.(null);
      return;
    }
    const handle = await getBaseDirectory();
    if (!handle) {
      setState({ kind: 'empty' });
      onHandleChange?.(null);
      return;
    }
    const label = await describeBaseDir(handle);
    const granted = await ensurePermission(handle, 'readwrite');
    setState({ kind: 'ready', handle, label, granted });
    onHandleChange?.(granted ? handle : null);
  }, [onHandleChange]);

  React.useEffect(() => {
    void probe();
  }, [probe]);

  const onPick = async () => {
    setBusy(true);
    try {
      const handle = await pickBaseDirectory();
      if (!handle) return; // unsupported or cancelled
      const label = await describeBaseDir(handle);
      const granted = await ensurePermission(handle, 'readwrite');
      setState({ kind: 'ready', handle, label, granted });
      onHandleChange?.(granted ? handle : null);
    } catch (err) {
      // The user dismissed the picker or the browser refused. Show an empty state.
      // eslint-disable-next-line no-console
      console.warn('pickBaseDirectory failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    setBusy(true);
    try {
      await clearBaseDirectory();
      setState({ kind: 'empty' });
      onHandleChange?.(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            <CardTitle className="text-base">Carpeta de destino</CardTitle>
          </div>
          <Badge variant={state.kind === 'ready' && state.granted ? 'success' : 'muted'}>
            {state.kind === 'unsupported' ? 'No soportado' : 'File System Access'}
          </Badge>
        </div>
        <CardDescription>
          Carpeta local donde se escribirán los respaldos. El navegador pedirá permiso una vez y lo recordará entre sesiones.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.kind === 'loading' ? (
          <Skeleton className="h-9 w-full" />
        ) : state.kind === 'unsupported' ? (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 text-yellow-700 dark:text-yellow-300" />
            <div>
              <p className="font-medium">Tu navegador no soporta escritura directa a carpetas.</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Firefox / Safari: cada descarga abrirá el diálogo &quot;Guardar como&quot; del navegador. Puedes continuar con el respaldo masivo.
              </p>
            </div>
          </div>
        ) : state.kind === 'empty' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onPick} disabled={busy}>
              <FolderOpen className="h-4 w-4 mr-1" /> Elegir carpeta
            </Button>
            <p className="text-xs text-muted-foreground">Ninguna carpeta seleccionada todavía.</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-[160px] truncate rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
              {state.label || '(unnamed folder)'}
            </code>
            {!state.granted && (
              <Badge variant="warning" className="text-[10px]">
                Permiso revocado
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={onPick} disabled={busy}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Cambiar
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
              <X className="h-3.5 w-3.5 mr-1" /> Olvidar
            </Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Las rutas por workflow son relativas a esta carpeta. Ej.: <code className="font-mono">production/wf1.json</code>.
        </p>
      </CardContent>
    </Card>
  );
}
