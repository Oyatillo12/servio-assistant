/**
 * Minimal RFC 4180-ish CSV serializer. No deps, no streaming — meant for the
 * small/medium exports we produce from the admin UI (up to a few thousand rows).
 * If we ever need to stream, swap this for `csv-stringify`.
 */

export interface CsvColumn<T> {
  header: string;
  get: (row: T) => unknown;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => csvEscape(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => csvEscape(c.get(r))).join(','))
    .join('\n');
  return header + '\n' + body + (rows.length > 0 ? '\n' : '');
}

/** Quote when the value contains a separator, quote, or newline; double embedded quotes. */
function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
