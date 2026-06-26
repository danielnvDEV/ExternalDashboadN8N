import { safeFilename } from './download';

const STORAGE_KEY = 'backup-paths';

/** Read all per-workflow backup paths. Missing key → empty object. */
export function getBackupPaths(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist one workflow's relative path. Pass an empty string to remove it. */
export function setBackupPath(workflowId: string, relPath: string): void {
  if (typeof window === 'undefined') return;
  const current = getBackupPaths();
  if (relPath === '') {
    delete current[workflowId];
  } else {
    current[workflowId] = relPath;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* quota / private mode — best-effort */
  }
}

/** Default path when the user hasn't customized one for a workflow. */
export function defaultBackupPath(name: string | null | undefined, workflowId: string): string {
  return `${safeFilename(name ?? '', workflowId)}.json`;
}

/**
 * Folder-aware default. When the workflow lives in a folder, the suggested
 * path mirrors that hierarchy (e.g. "production/api/mi-workflow.json"),
 * which lines up nicely with the on-disk layout users typically want.
 */
export function defaultBackupPathFor(
  name: string | null | undefined,
  workflowId: string,
  folderPath?: string | null,
): string {
  const file = defaultBackupPath(name, workflowId);
  const cleanFolder = (folderPath ?? '').replace(/^\/+|\/+$/g, '');
  if (!cleanFolder) return file;
  return `${cleanFolder}/${file}`;
}

export interface PathValidation {
  ok: boolean;
  /** Path after normalization (slashes, trim, .json suffix). undefined when invalid. */
  normalized?: string;
  error?: string;
}

/**
 * Accept only relative paths. Disallow absolute paths ("/foo"), drive letters
 * ("C:\\foo"), and ".." segments. Normalize backslashes to forward slashes.
 * Append ".json" if missing.
 */
export function validateBackupPath(input: string): PathValidation {
  if (typeof input !== 'string') return { ok: false, error: 'Empty path' };
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Empty path' };
  if (trimmed.length > 512) return { ok: false, error: 'Path too long' };
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return { ok: false, error: 'Absolute paths are not allowed' };
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    return { ok: false, error: 'Absolute paths are not allowed' };
  }

  const replaced = trimmed.replace(/\\/g, '/');
  const parts = replaced.split('/').filter((p) => p.length > 0);
  if (parts.length === 0) return { ok: false, error: 'Empty path' };

  for (const seg of parts) {
    if (seg === '.' || seg === '..') {
      return { ok: false, error: 'Path cannot contain "." or ".."' };
    }
    if (/[<>:"|?*\x00-\x1f]/.test(seg)) {
      return { ok: false, error: `Invalid segment "${seg}"` };
    }
  }

  let file = parts[parts.length - 1];
  const dirs = parts.slice(0, -1);
  if (!file.toLowerCase().endsWith('.json')) file = `${file}.json`;

  return { ok: true, normalized: [...dirs, file].join('/') };
}

export interface DedupeResult {
  paths: Record<string, string>;
  duplicates: Array<{ workflowId: string; workflowName: string; original: string; renamed: string }>;
}

/**
 * Resolve the final path for every workflow. If two workflows resolve to the
 * same target path, the second occurrence (and beyond) gets a `-<id>` suffix
 * inserted before the extension. Duplicates never overwrite each other.
 */
export function resolveFinalPaths(
  workflows: Array<{ id: string; name?: string | null; folderPath?: string | null }>,
  customPaths: Record<string, string>,
): DedupeResult {
  const paths: Record<string, string> = {};
  const seen = new Set<string>();
  const duplicates: DedupeResult['duplicates'] = [];

  for (const wf of workflows) {
    const stored = customPaths[wf.id];
    const candidate =
      stored && stored.length > 0
        ? stored
        : defaultBackupPathFor(wf.name, wf.id, wf.folderPath);
    const validation = validateBackupPath(candidate);
    const fallback = defaultBackupPathFor(wf.name, wf.id, wf.folderPath);
    const normalized = validation.ok && validation.normalized ? validation.normalized : fallback;

    if (!seen.has(normalized)) {
      seen.add(normalized);
      paths[wf.id] = normalized;
      continue;
    }

    const { base, ext } = splitName(normalized);
    const renamed = `${base}-${wf.id}${ext}`;
    paths[wf.id] = renamed;
    duplicates.push({
      workflowId: wf.id,
      workflowName: wf.name ?? '',
      original: normalized,
      renamed,
    });
    seen.add(renamed);
  }

  return { paths, duplicates };
}

function splitName(path: string): { base: string; ext: string } {
  const idx = path.lastIndexOf('/');
  const dir = idx >= 0 ? path.slice(0, idx + 1) : '';
  const file = idx >= 0 ? path.slice(idx + 1) : path;
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return { base: dir + file, ext: '' };
  return { base: dir + file.slice(0, dot), ext: file.slice(dot) };
}
