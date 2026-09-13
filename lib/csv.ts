// lib/csv.ts
//
// Minimal RFC 4180 CSV writer + browser download, for the admin export
// buttons. No dependency: the whole job is quoting correctly and handing the
// browser a Blob.

/**
 * Quotes one field.
 *
 * Always quoting (rather than only when the value contains a comma) keeps the
 * output stable and sidesteps the whole class of "looks fine until someone's
 * name has a comma in it" bugs. Inner quotes are doubled, per the spec.
 *
 * The leading-character guard defuses CSV injection: Excel and Sheets execute
 * a cell starting with = + - @ as a formula, so an order placed under the
 * customer name `=HYPERLINK(...)` would run on the admin's machine when they
 * open the export. Prefixing a tab keeps the text readable while making the
 * cell inert.
 */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `\t${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Renders a header row + data rows as a CSV document. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvField).join(",")];
  for (const row of rows) lines.push(row.map(csvField).join(","));
  // CRLF line endings — what Excel expects.
  return lines.join("\r\n");
}

/**
 * Triggers a download of `csv` as `filename`.
 *
 * The BOM is not decoration: without it Excel on Windows reads the file as
 * the system codepage and mangles every non-ASCII character (₱, é, ñ) in an
 * export that is full of peso amounts.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** `orders-2026-09-03.csv` — a filename that sorts chronologically. */
export function timestampedFilename(prefix: string, extension = "csv"): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    `${now.getMonth() + 1}`.padStart(2, "0"),
    `${now.getDate()}`.padStart(2, "0"),
  ].join("-");
  return `${prefix}-${stamp}.${extension}`;
}
