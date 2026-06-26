/**
 * Server-side, TTL-based file cache for opaque session payloads (n8n cookies,
 * bearer tokens, etc.). NOT meant for browser-side use.
 *
 * - Atomic writes (write to .tmp then rename) so a crash mid-write cannot
 *   leave a half-written file that the next boot will trust.
 * - Coarse per-process mutex via a single in-memory Promise chain: the
 *   dashboard only ever has one Node process for these route handlers, so a
 *   module-level promise queue is enough.
 * - Reads that hit a missing/corrupt/expired file return undefined silently.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getEnv } from './env';

export interface CachedSession<T = unknown> {
  fetchedAt: number;
  expiresAt: number;
  payload: T;
}

const locks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  // Keep the chain alive but don't propagate errors to subsequent waiters.
  locks.set(key, next.catch(() => undefined));
  return next;
}

function defaultSessionFile(): string {
  const env = getEnv();
  if (env.N8N_INTERNAL_SESSION_FILE) return env.N8N_INTERNAL_SESSION_FILE;
  // project root = cwd when running `next dev` / `next start` from the repo.
  return path.join(process.cwd(), '.dashboard-internal-session.json');
}

export async function readSession<T = unknown>(key: string): Promise<CachedSession<T> | undefined> {
  return withLock(`read:${key}`, async () => {
    const file = defaultSessionFile();
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, CachedSession<T>>;
      const entry = parsed[key];
      if (!entry) return undefined;
      if (typeof entry.expiresAt !== 'number' || entry.expiresAt <= Date.now()) {
        return undefined;
      }
      return entry;
    } catch {
      return undefined;
    }
  });
}

export async function writeSession<T = unknown>(
  key: string,
  payload: T,
  ttlMs: number,
): Promise<CachedSession<T>> {
  return withLock(`write:${key}`, async () => {
    const file = defaultSessionFile();
    const entry: CachedSession<T> = {
      fetchedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      payload,
    };
    const readOrEmpty = await readRaw(file);
    const merged = { ...readOrEmpty, [key]: entry };
    await atomicWrite(file, JSON.stringify(merged, null, 2));
    return entry;
  });
}

export async function clearSession(key: string): Promise<void> {
  await withLock(`clear:${key}`, async () => {
    const file = defaultSessionFile();
    const current = await readRaw(file);
    if (!(key in current)) return;
    delete current[key];
    await atomicWrite(file, JSON.stringify(current, null, 2));
  });
}

async function readRaw(file: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

async function atomicWrite(file: string, contents: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(tmp, contents, { mode: 0o600 });
  await fs.rename(tmp, file);
}