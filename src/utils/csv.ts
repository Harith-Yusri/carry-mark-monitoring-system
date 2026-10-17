/** Prevent spreadsheet formula execution while preserving valid CSV text. */
export function escapeCsv(value: unknown): string {
  const raw = String(value ?? "");
  const safe = /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
