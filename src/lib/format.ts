import { formatDistanceToNow, format as formatDate } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

const locales = { es, en: enUS } as const;
type LocaleKey = keyof typeof locales;

export function relativeTime(iso: string | Date | null | undefined, locale: LocaleKey = 'en'): string {
  if (!iso) return '-';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '-';
  return formatDistanceToNow(d, { addSuffix: true, locale: locales[locale] });
}

export function absoluteTime(iso: string | Date | null | undefined, locale: LocaleKey = 'en'): string {
  if (!iso) return '-';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '-';
  return formatDate(d, 'yyyy-MM-dd HH:mm:ss', { locale: locales[locale] });
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '-';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatNumber(n: number | null | undefined, opts: Intl.NumberFormatOptions = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return new Intl.NumberFormat(undefined, opts).format(n);
}

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function truncate(s: string | null | undefined, n = 60): string {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

export function safeJsonStringify(obj: unknown, indent = 2): string {
  try {
    return JSON.stringify(obj, null, indent);
  } catch {
    return String(obj);
  }
}
