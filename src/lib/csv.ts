/** UTF-8 BOM so Excel opens the CSV with the right encoding. */
export const CSV_BOM = '﻿';

function escapeCsvValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build the ordered list of CSV headers for a set of rows: the table's declared
 * columns first, then any extra keys present in the rows (e.g. id/createdAt)
 * so nothing is silently dropped from the backup.
 */
export function deriveHeaders(
  columnNames: string[],
  rows: Array<Record<string, unknown>>,
): string[] {
  const headers = [...columnNames];
  const seen = new Set(columnNames);
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return headers;
}

export function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvValue(row[h])).join(','));
  }
  return lines.join('\r\n');
}
