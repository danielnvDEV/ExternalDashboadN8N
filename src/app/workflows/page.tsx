'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Box, Filter, MoreHorizontal, Pause, Play, Power, PowerOff, Search, Tag as TagIcon, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CursorPagination, useCursorPagination } from '@/components/data-table/pagination-cursor';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageError } from '@/components/capability-gate';
import { relativeTime, truncate } from '@/lib/format';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import { useInternalFolderData } from '@/lib/use-internal-folders';
import { cn } from '@/lib/cn';
import type { PaginatedResponse, Tag, Workflow, Folder } from '@/lib/types';
import type { FolderPathMap } from '@/lib/folder-paths';
import {
  FolderNavigator,
  describeFolderSelection,
  expandFolderSelection,
  type FolderSelection,
} from '@/components/workflow/folder-navigator';

const FOLDER_PARAM = 'folder';
const FOLDER_ALL: FolderSelection = 'all';

export default function WorkflowsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const [name, setName] = React.useState(sp.get('name') ?? '');
  const [activeFilter, setActiveFilter] = React.useState<string>(sp.get('active') ?? '');
  const [tagFilter, setTagFilter] = React.useState<string>(sp.get('tags') ?? '');
  const [excludePinned, setExcludePinned] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const folderSelection: FolderSelection = React.useMemo(() => {
    const raw = sp.get(FOLDER_PARAM);
    if (!raw || raw === 'all') return FOLDER_ALL;
    if (raw === 'none') return 'none';
    return raw;
  }, [sp]);

  const setFolderSelection = React.useCallback(
    (next: FolderSelection) => {
      const params = new URLSearchParams(sp.toString());
      if (next === FOLDER_ALL) params.delete(FOLDER_PARAM);
      else params.set(FOLDER_PARAM, next);
      const qs = params.toString();
      router.replace(qs ? `/workflows?${qs}` : '/workflows', { scroll: false });
    },
    [router, sp],
  );

  const params: Record<string, unknown> = { limit: 100, excludePinnedData: excludePinned };
  if (name) params.name = name;
  if (activeFilter === 'true' || activeFilter === 'false') params.active = activeFilter;
  if (tagFilter) params.tags = tagFilter;

  const q = useCursorPagination<Workflow>('workflows', params, {
    queryKey: [name, activeFilter, tagFilter, excludePinned],
  });

  // Reset selection when results change
  React.useEffect(() => {
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.length, q.nextCursor]);

  const tagsQ = useQuery<PaginatedResponse<Tag>>({
    queryKey: ['n8n-tags-workflows'],
    queryFn: () => apiFetch('tags', { query: { limit: 100 } }),
  });

  const folderData = useInternalFolderData();
  const showFolderNav = folderData.available || folderData.isLoading;

  const allowedFolderIds = React.useMemo(
    () => expandFolderSelection(folderSelection, folderData.pathMap),
    [folderSelection, folderData.pathMap],
  );

  const visibleWorkflows = React.useMemo(() => {
    if (allowedFolderIds === null) return q.data;
    if (allowedFolderIds.size === 0) {
      return q.data.filter((w) => folderData.workflowFolderId.get(w.id) == null);
    }
    return q.data.filter((w) => {
      const fid = folderData.workflowFolderId.get(w.id);
      return fid != null && allowedFolderIds.has(fid);
    });
  }, [q.data, allowedFolderIds, folderData.workflowFolderId]);

  const selectionLabel = describeFolderSelection(folderSelection, folderData.pathMap);

  const bulkAction = async (action: 'activate' | 'deactivate' | 'archive' | 'unarchive' | 'delete') => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        if (action === 'delete') {
          await apiFetch(`workflows/${id}`, { method: 'DELETE' });
        } else {
          await apiFetch(`workflows/${id}/${action}`, { method: 'POST' });
        }
        ok++;
      } catch {
        fail++;
      }
    }
    q.refetch();
    setSelected(new Set());
    toast({
      title: `Bulk ${action} complete`,
      description: `${ok} succeeded${fail ? `, ${fail} failed` : ''}`,
      variant: fail ? 'destructive' : 'success',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {visibleWorkflows.length} workflow{visibleWorkflows.length === 1 ? '' : 's'} en {selectionLabel.toLowerCase()}
            {selected.size > 0 && <span className="ml-2">· {selected.size} seleccionados</span>}
          </p>
        </div>
        {showFolderNav && folderSelection !== FOLDER_ALL && (
          <Badge variant="outline" className="text-[10px]">
            Filtrando por carpeta
          </Badge>
        )}
      </div>

      <div className={cn('grid gap-4', showFolderNav ? 'md:grid-cols-[260px_1fr]' : undefined)}>
        {showFolderNav && (
          <FolderNavigator
            available={folderData.available}
            isLoading={folderData.isLoading}
            roots={folderData.pathMap.roots}
            pathMap={folderData.pathMap}
            folderTotalCount={folderData.folderTotalCount}
            unfolderedCount={folderData.unfolderedCount}
            totalCount={folderData.totalCount}
            selected={folderSelection}
            onSelect={setFolderSelection}
          />
        )}

        <div className="space-y-4 min-w-0">
          {showFolderNav && (
            <MobileFolderSelect
              roots={folderData.pathMap.roots}
              pathMap={folderData.pathMap}
              folderTotalCount={folderData.folderTotalCount}
              unfolderedCount={folderData.unfolderedCount}
              totalCount={folderData.totalCount}
              selected={folderSelection}
              onSelect={setFolderSelection}
            />
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[180px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por nombre…"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={activeFilter || 'all'} onValueChange={(v) => setActiveFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Activos</SelectItem>
                    <SelectItem value="false">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tagFilter || 'all'} onValueChange={(v) => setTagFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Cualquier tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Cualquier tag</SelectItem>
                    {tagsQ.data?.data.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox checked={excludePinned} onCheckedChange={(v) => setExcludePinned(!!v)} />
                  Excluir pinned data
                </label>
                <Button variant="ghost" size="sm" onClick={() => q.first()}>
                  <Filter className="h-3.5 w-3.5 mr-1" /> Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selected.size > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
                  <span className="text-xs text-muted-foreground mr-2">Acciones en lote:</span>
                  <Button size="sm" variant="outline" onClick={() => bulkAction('activate')}>
                    <Power className="h-3.5 w-3.5 mr-1" /> Activar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => bulkAction('deactivate')}>
                    <PowerOff className="h-3.5 w-3.5 mr-1" /> Desactivar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => bulkAction('archive')}>
                    <Archive className="h-3.5 w-3.5 mr-1" /> Archivar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => bulkAction('unarchive')}>
                    <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Desarchivar
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                      </Button>
                    }
                    title={`¿Eliminar ${selected.size} workflow${selected.size === 1 ? '' : 's'}?`}
                    description="Esta acción es permanente. Los workflows se eliminarán por completo."
                    confirmText="Eliminar para siempre"
                    onConfirm={() => bulkAction('delete')}
                  />
                </div>
              )}

              {q.isError ? (
                <PageError error={q.error} />
              ) : q.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : visibleWorkflows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {folderSelection !== FOLDER_ALL
                    ? 'No hay workflows que coincidan con los filtros en esta carpeta.'
                    : 'No hay workflows que coincidan con los filtros.'}
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs">
                      <tr>
                        <th className="w-8 p-2">
                          <Checkbox
                            checked={selected.size === visibleWorkflows.length && visibleWorkflows.length > 0}
                            onCheckedChange={(checked) => {
                              setSelected(checked ? new Set(visibleWorkflows.map((w) => w.id)) : new Set());
                            }}
                          />
                        </th>
                        <th className="text-left p-2 font-medium">Nombre</th>
                        <th className="text-left p-2 font-medium w-20">Estado</th>
                        <th className="text-left p-2 font-medium hidden md:table-cell w-32">Nodos</th>
                        <th className="text-left p-2 font-medium hidden lg:table-cell">Tags</th>
                        <th className="text-left p-2 font-medium hidden sm:table-cell w-32">Actualizado</th>
                        <th className="w-8 p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleWorkflows.map((w) => (
                        <tr
                          key={w.id}
                          className={cn(
                            'border-t hover:bg-muted/30 transition-colors',
                            w.isArchived && 'opacity-60',
                          )}
                        >
                          <td className="p-2">
                            <Checkbox
                              checked={selected.has(w.id)}
                              onCheckedChange={(checked) => {
                                setSelected((s) => {
                                  const ns = new Set(s);
                                  if (checked) ns.add(w.id);
                                  else ns.delete(w.id);
                                  return ns;
                                });
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() => router.push(`/workflows/${w.id}`)}
                              className="text-left hover:underline font-medium"
                            >
                              {w.name || <span className="text-muted-foreground italic">Sin nombre</span>}
                            </button>
                            {w.isArchived && (
                              <Badge variant="muted" className="ml-2 text-[10px]">archivado</Badge>
                            )}
                          </td>
                          <td className="p-2">
                            {w.active ? (
                              <Badge variant="success" className="text-[10px]">
                                <Power className="h-3 w-3 mr-1" /> Activo
                              </Badge>
                            ) : (
                              <Badge variant="muted">Inactivo</Badge>
                            )}
                          </td>
                          <td className="p-2 hidden md:table-cell text-xs text-muted-foreground">
                            {w.nodes?.length ?? 0}
                          </td>
                          <td className="p-2 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {w.tags?.slice(0, 3).map((t) => (
                                <Badge key={t.id} variant="outline" className="text-[10px]">
                                  <TagIcon className="h-2.5 w-2.5 mr-0.5" /> {truncate(t.name, 16)}
                                </Badge>
                              ))}
                              {(w.tags?.length ?? 0) > 3 && (
                                <Badge variant="muted" className="text-[10px]">+{(w.tags?.length ?? 0) - 3}</Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2 hidden sm:table-cell text-xs text-muted-foreground">
                            {relativeTime(w.updatedAt)}
                          </td>
                          <td className="p-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Acciones">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/workflows/${w.id}`)}>
                                  <Box className="h-3.5 w-3.5 mr-2" /> Abrir
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {!w.active ? (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      await apiFetch(`workflows/${w.id}/activate`, { method: 'POST' });
                                      q.refetch();
                                      toast({ title: 'Activado', description: w.name, variant: 'success' });
                                    }}
                                  >
                                    <Play className="h-3.5 w-3.5 mr-2" /> Activar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      await apiFetch(`workflows/${w.id}/deactivate`, { method: 'POST' });
                                      q.refetch();
                                      toast({ title: 'Desactivado', description: w.name });
                                    }}
                                  >
                                    <Pause className="h-3.5 w-3.5 mr-2" /> Desactivar
                                  </DropdownMenuItem>
                                )}
                                {!w.isArchived ? (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      await apiFetch(`workflows/${w.id}/archive`, { method: 'POST' });
                                      q.refetch();
                                      toast({ title: 'Archivado', description: w.name });
                                    }}
                                  >
                                    <Archive className="h-3.5 w-3.5 mr-2" /> Archivar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      await apiFetch(`workflows/${w.id}/unarchive`, { method: 'POST' });
                                      q.refetch();
                                      toast({ title: 'Desarchivado', description: w.name });
                                    }}
                                  >
                                    <ArchiveRestore className="h-3.5 w-3.5 mr-2" /> Desarchivar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <ConfirmDialog
                                  trigger={
                                    <DropdownMenuItem
                                      onSelect={(e) => e.preventDefault()}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                                    </DropdownMenuItem>
                                  }
                                  title={`¿Eliminar "${w.name || 'Sin nombre'}"?`}
                                  description="Esto eliminará el workflow permanentemente."
                                  confirmText="Eliminar para siempre"
                                  onConfirm={async () => {
                                    await apiFetch(`workflows/${w.id}`, { method: 'DELETE' });
                                    q.refetch();
                                    toast({ title: 'Eliminado', description: w.name });
                                  }}
                                />
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <CursorPagination
                  page={q.page}
                  canPrev={q.canPrev}
                  canNext={q.canNext}
                  onPrev={q.prev}
                  onNext={q.next}
                  onFirst={q.first}
                  isLoading={q.isFetching}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact mobile-friendly folder picker. Renders only below `md` to avoid
 * duplicating the tree on wider viewports.
 */
function MobileFolderSelect(props: {
  roots: Folder[];
  pathMap: FolderPathMap;
  folderTotalCount: Map<string, number>;
  unfolderedCount: number;
  totalCount: number;
  selected: FolderSelection;
  onSelect: (s: FolderSelection) => void;
}) {
  const { roots, pathMap, folderTotalCount, unfolderedCount, totalCount, selected, onSelect } = props;
  // Flatten the tree so we can show nested folders in a single Select.
  const flat = React.useMemo(() => {
    const out: Array<{ id: FolderSelection; label: string; count: number }> = [
      { id: 'all', label: 'Todos los workflows', count: totalCount },
      { id: 'none', label: 'Sin carpeta', count: unfolderedCount },
    ];
    const visit = (f: Folder, depth: number) => {
      const count = folderTotalCount.get(f.id) ?? 0;
      out.push({ id: f.id, label: `${'  '.repeat(depth)}${f.name}`, count });
      const children = pathMap.childrenById.get(f.id) ?? [];
      children.forEach((c: Folder) => visit(c, depth + 1));
    };
    roots.forEach((r) => visit(r, 0));
    return out;
  }, [roots, pathMap, folderTotalCount, unfolderedCount, totalCount]);

  return (
    <div className="md:hidden">
      <Select value={selected} onValueChange={(v) => onSelect(v as FolderSelection)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {flat.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label} ({item.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
