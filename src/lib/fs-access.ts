'use client';

const DB_NAME = 'backup-db';
const STORE = 'handles';
const KEY = 'base-dir';

interface FSAWindow {
  showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
}

interface FileSystemWritableFileStream {
  write: (data: Blob | string) => Promise<void>;
  close: () => Promise<void>;
}

interface FileSystemFileHandle {
  createWritable: () => Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle {
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FileSystemFileHandle>;
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<FileSystemDirectoryHandle>;
  queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'prompt' | 'denied'>;
  requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'prompt' | 'denied'>;
}

export function isFsAccessSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as FSAWindow).showDirectoryPicker === 'function';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function pickBaseDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const fn = (window as unknown as FSAWindow).showDirectoryPicker;
  if (!fn) return null;
  const handle = await fn({ mode: 'readwrite' });
  await idbSet(KEY, handle);
  return handle;
}

export async function getBaseDirectory(): Promise<FileSystemDirectoryHandle | null> {
  return (await idbGet<FileSystemDirectoryHandle>(KEY)) ?? null;
}

export async function clearBaseDirectory(): Promise<void> {
  await idbDel(KEY);
}

export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  if (!handle.queryPermission) return true;
  const status = await handle.queryPermission({ mode });
  if (status === 'granted') return true;
  if (!handle.requestPermission) return false;
  const next = await handle.requestPermission({ mode });
  return next === 'granted';
}

/** Split "a/b/c.json" → ["a", "b"], "c.json". Empty parts are dropped. */
function splitPath(relPath: string): { dirs: string[]; file: string } {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter((p) => p.length > 0 && p !== '.' && p !== '..');
  if (parts.length === 0) throw new Error('Empty path');
  const file = parts.pop()!;
  return { dirs: parts, file };
}

export async function writeJsonToBase(
  base: FileSystemDirectoryHandle,
  relPath: string,
  data: unknown,
): Promise<void> {
  const { dirs, file } = splitPath(relPath);
  let dir: FileSystemDirectoryHandle = base;
  for (const segment of dirs) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }
  const fileHandle = await dir.getFileHandle(file, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function writeTextToBase(
  base: FileSystemDirectoryHandle,
  relPath: string,
  text: string,
): Promise<void> {
  const { dirs, file } = splitPath(relPath);
  let dir: FileSystemDirectoryHandle = base;
  for (const segment of dirs) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }
  const fileHandle = await dir.getFileHandle(file, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

/** Best-effort label for the picked folder. */
export async function describeBaseDir(base: FileSystemDirectoryHandle): Promise<string> {
  // FileSystemDirectoryHandle has no public `name` in all browsers; iterate as fallback.
  const fns = Object.getOwnPropertyNames(base);
  if (fns.includes('name')) {
    return (base as unknown as { name: string }).name || '(unnamed)';
  }
  return '(unnamed folder)';
}

export type { FileSystemDirectoryHandle };
