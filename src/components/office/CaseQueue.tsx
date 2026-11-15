import Link from "next/link";
import StatusChip from "./StatusChip";
import { fmtDate, type Dict, type Lang } from "@/lib/i18n";
import type { CaseRecord } from "@/lib/types";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic";

/** Table from md up, stacked cards on phones. Both render the same cases. */
export default function CaseQueue({ cases, t, lang }: { cases: CaseRecord[]; t: Dict; lang: Lang }) {
  return (
    <>
      <p className="text-sm text-slate-600">{t.ofCount}: {cases.length}</p>

      <ul aria-label={t.ofQueueAria} className="space-y-3 md:hidden">
        {cases.map((c) => (
          <li key={c.ref}>
            <Link href={`/office/${c.ref}`} className={`block min-h-11 space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 ${focus}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-500">{c.ref}</span>
                <StatusChip status={c.status} label={t.statuses[c.status]} />
              </div>
              <div className="font-medium">{c.title}</div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
                <span className="text-teal">{t.cats[c.category]}</span>
                <span className="text-slate-500">{c.area || t.ofNoArea} · {fmtDate(c.createdAt, lang)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t.ofQueueAria}</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[t.ofColRef, t.ofColTitle, t.ofColCat, t.ofColArea, t.ofColStatus, t.ofColDate].map((h) => (
                <th key={h} scope="col" className="px-3 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((c) => (
              <tr key={c.ref} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-1 text-slate-500">{c.ref}</td>
                <td className="px-3 py-1 font-medium">
                  <Link href={`/office/${c.ref}`} className={`-mx-1 inline-flex min-h-11 items-center rounded px-1 text-civic underline ${focus}`}>
                    {c.title}
                    <span className="sr-only"> — {t.ofOpenCase}</span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-1 text-teal">{t.cats[c.category]}</td>
                <td className="px-3 py-1">{c.area || <span className="text-slate-400">{t.ofNoArea}</span>}</td>
                <td className="px-3 py-1"><StatusChip status={c.status} label={t.statuses[c.status]} /></td>
                <td className="whitespace-nowrap px-3 py-1 text-slate-500">{fmtDate(c.createdAt, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
