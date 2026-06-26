/**
 * Build folder paths from the flat folder array returned by n8n.
 *
 * n8n gives us folders as flat records with `parentFolderId` (nullable).
 * To show a workflow's location as "production/api" we walk up the parent
 * chain until we hit a folder with no parent.
 */
import type { Folder } from './types';

export interface FolderPathMap {
  /** id → folder record. */
  byId: Map<string, Folder>;
  /** id → slash-separated path from the root (e.g. "production/api"). */
  pathById: Map<string, string>;
  /** id → ["production", "api"]. Useful for breadcrumbs. */
  segmentsById: Map<string, string[]>;
  /** Children of a given folder id (empty array when none). */
  childrenById: Map<string, Folder[]>;
  /** Top-level folders (parentFolderId is null or missing). */
  roots: Folder[];
}

const SAFE_SEGMENT = (s: string) => s.replace(/[\\/]/g, '_').trim();

export function buildFolderPathMap(folders: Folder[]): FolderPathMap {
  const byId = new Map<string, Folder>();
  for (const f of folders) byId.set(f.id, f);

  const pathById = new Map<string, string>();
  const segmentsById = new Map<string, string[]>();

  const resolve = (id: string, guard: Set<string>): string[] => {
    if (guard.has(id)) return []; // cycle guard
    const folder = byId.get(id);
    if (!folder) return [];
    if (!folder.parentFolderId) return [SAFE_SEGMENT(folder.name)];
    guard.add(id);
    const parentSegs = resolve(folder.parentFolderId, guard);
    return [...parentSegs, SAFE_SEGMENT(folder.name)];
  };

  for (const f of folders) {
    const segs = resolve(f.id, new Set());
    segmentsById.set(f.id, segs);
    pathById.set(f.id, segs.join('/'));
  }

  const childrenById = new Map<string, Folder[]>();
  for (const f of folders) {
    if (f.parentFolderId) {
      const arr = childrenById.get(f.parentFolderId) ?? [];
      arr.push(f);
      childrenById.set(f.parentFolderId, arr);
    }
  }

  const roots = folders.filter((f) => !f.parentFolderId);

  return { byId, pathById, segmentsById, childrenById, roots };
}

export function folderPathFor(map: FolderPathMap, folderId: string | null | undefined): string {
  if (!folderId) return '';
  return map.pathById.get(folderId) ?? '';
}