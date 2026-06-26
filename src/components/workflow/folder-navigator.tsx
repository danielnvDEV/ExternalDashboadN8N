'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Folder as FolderIcon, FolderOpen, FolderMinus, Inbox, ListTree } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import type { Folder } from '@/lib/types';
import type { FolderPathMap } from '@/lib/folder-paths';

/**
 * `'all'`  — no filter (every workflow).
 * `'none'` — only workflows without any folder.
 * `<id>`   — only workflows inside this folder AND its descendants.
 */
export type FolderSelection = 'all' | 'none' | string;

export interface FolderNavigatorProps {
  available: boolean;
  isLoading: boolean;
  roots: Folder[];
  pathMap: FolderPathMap;
  folderTotalCount: Map<string, number>;
  unfolderedCount: number;
  totalCount: number;
  selected: FolderSelection;
  onSelect: (selection: FolderSelection) => void;
  className?: string;
}

interface RowProps {
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  countLabel?: string;
}

function Row({
  depth,
  hasChildren,
  expanded,
  onToggle,
  active,
  onClick,
  icon,
  label,
  count,
  countLabel,
}: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-muted/60 text-foreground/90',
      )}
      style={{ paddingLeft: `${0.375 + depth * 0.875}rem` }}
    >
      <span
        role="button"
        tabIndex={hasChildren ? 0 : -1}
        aria-label={expanded ? 'Collapse' : 'Expand'}
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted',
          !hasChildren && 'invisible',
        )}
        onClick={(e) => {
          if (!hasChildren) return;
          e.stopPropagation();
          onToggle();
        }}
        onKeyDown={(e) => {
          if (!hasChildren) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }
        }}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </span>
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      <span
        className={cn(
          'shrink-0 rounded px-1.5 py-0.5 text-[10px] tabular-nums',
          active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
        title={countLabel}
      >
        {count}
      </span>
    </button>
  );
}

function FolderNode({
  folder,
  depth,
  pathMap,
  folderTotalCount,
  selected,
  onSelect,
  expanded,
  onToggle,
}: {
  folder: Folder;
  depth: number;
  pathMap: FolderPathMap;
  folderTotalCount: Map<string, number>;
  selected: FolderSelection;
  onSelect: (id: string) => void;
  expanded: Map<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const children = pathMap.childrenById.get(folder.id) ?? [];
  const isExpanded = expanded.get(folder.id) ?? true;
  const count = folderTotalCount.get(folder.id) ?? 0;
  const isActive = selected === folder.id;
  return (
    <>
      <Row
        depth={depth}
        hasChildren={children.length > 0}
        expanded={isExpanded}
        onToggle={() => onToggle(folder.id)}
        active={isActive}
        onClick={() => onSelect(folder.id)}
        icon={
          isActive || (isExpanded && children.length > 0) ? (
            <FolderOpen className="h-3.5 w-3.5 text-primary" />
          ) : (
            <FolderIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )
        }
        label={folder.name}
        count={count}
        countLabel={`${count} workflow${count === 1 ? '' : 's'} (incl. subcarpetas)`}
      />
      {isExpanded &&
        children.map((c: Folder) => (
          <FolderNode
            key={c.id}
            folder={c}
            depth={depth + 1}
            pathMap={pathMap}
            folderTotalCount={folderTotalCount}
            selected={selected}
            onSelect={onSelect}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

export function FolderNavigator({
  available,
  isLoading,
  roots,
  pathMap,
  folderTotalCount,
  unfolderedCount,
  totalCount,
  selected,
  onSelect,
  className,
}: FolderNavigatorProps) {
  // Persist expand/collapse locally so it survives navigation.
  const [expanded, setExpanded] = React.useState<Map<string, boolean>>(() => new Map());
  const onToggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Map(prev);
      next.set(id, !(next.get(id) ?? true));
      return next;
    });
  }, []);

  if (!available && !isLoading) return null;

  return (
    <Card className={cn('md:sticky md:top-4 md:self-start', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <ListTree className="h-3.5 w-3.5" /> Navegación
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-2 pb-2">
        {isLoading && !available ? (
          <div className="space-y-1.5 p-1">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-5/6" />
            <Skeleton className="h-7 w-4/6" />
            <Skeleton className="h-7 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <Row
              depth={0}
              hasChildren={false}
              expanded={false}
              onToggle={() => undefined}
              active={selected === 'all'}
              onClick={() => onSelect('all')}
              icon={<Inbox className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Todos"
              count={totalCount}
              countLabel="Todos los workflows"
            />
            <Row
              depth={0}
              hasChildren={false}
              expanded={false}
              onToggle={() => undefined}
              active={selected === 'none'}
              onClick={() => onSelect('none')}
              icon={<FolderMinus className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Sin carpeta"
              count={unfolderedCount}
              countLabel="Workflows sin carpeta"
            />
            {roots.length > 0 && (
              <div className="mt-2 mb-1 px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                Carpetas
              </div>
            )}
            {roots.map((root) => (
              <FolderNode
                key={root.id}
                folder={root}
                depth={0}
                pathMap={pathMap}
                folderTotalCount={folderTotalCount}
                selected={selected}
                onSelect={onSelect}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Build the set of folder IDs that match a selection (this folder + all descendants). */
export function expandFolderSelection(
  selection: FolderSelection,
  pathMap: FolderPathMap,
): Set<string> | null {
  if (selection === 'all') return null;
  if (selection === 'none') return new Set();
  const out = new Set<string>([selection]);
  const queue: string[] = [selection];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = pathMap.childrenById.get(id) ?? [];
    for (const c of children) {
      if (!out.has(c.id)) {
        out.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return out;
}

/** Human-readable label for the active selection, suitable for headers/breadcrumbs. */
export function describeFolderSelection(
  selection: FolderSelection,
  pathMap: FolderPathMap,
): string {
  if (selection === 'all') return 'Todos los workflows';
  if (selection === 'none') return 'Sin carpeta';
  return pathMap.pathById.get(selection) ?? 'Carpeta';
}
