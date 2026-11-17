import type { ReactNode } from "react";
import { cx } from "./cx";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Keep the cell on one line (refs, dates). */
  nowrap?: boolean;
  /** Use this column as the card heading on phones. Only one column should set it. */
  primary?: boolean;
  align?: "start" | "end";
};

/**
 * Data table from md up; stacked cards (label: value pairs) on phones, so no horizontal scrolling at 375px.
 * Server-component friendly (no hooks). Pass `empty` to render something when `rows` is empty.
 */
export default function Table<T>({ columns, rows, rowKey, caption, empty }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Accessible name; shown to screen readers only. */
  caption: string;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const primary = columns.find((c) => c.primary);
  const rest = columns.filter((c) => c !== primary);
  return (
    <>
      <ul aria-label={caption} className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="space-y-2 jk-card p-4">
            {primary && <div className="font-medium">{primary.cell(r)}</div>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {rest.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-muted">{c.header}</dt>
                  <dd className="min-w-0 break-words">{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto jk-card md:block">
        <table className="w-full text-start text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-slate-50 text-muted">
            <tr>
              {columns.map((c) => <th key={c.key} scope="col" className={cx("px-3 py-3 font-medium", c.align === "end" ? "text-end" : "text-start")}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={rowKey(r)} className="hover:bg-slate-50">
                {columns.map((c) => <td key={c.key} className={cx("px-3 py-2 align-middle", c.nowrap && "whitespace-nowrap", c.align === "end" ? "text-end" : "text-start")}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
