/**
 * CSV for office exports (B7.10). UTF-8 with a byte-order mark so Excel opens Bangla correctly; RFC 4180 quoting; and a guard against
 * spreadsheet formula injection: a cell that would start with = + - @ tab or CR is prefixed with an apostrophe. (Values come from the database,
 * not from the person downloading, but an exported file is opened in tools that run formulas.)
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(columns: string[], rows: unknown[][]): string {
  return "﻿" + [columns, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Print-ready HTML table. The browser prints it to PDF with the device's own Bangla font and shaping, so conjuncts render correctly. */
export function toPrintHtml(title: string, meta: string, columns: string[], rows: unknown[][]): string {
  const head = columns.map((c) => `<th>${esc(c)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c instanceof Date ? c.toISOString() : c)}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:"Noto Sans Bengali","Hind Siliguri","Kohinoor Bangla",system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}@media print{@page{size:A4 landscape;margin:12mm}}</style></head><body><h1>${esc(title)}</h1><p>${esc(meta)}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}
