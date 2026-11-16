"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import StatusChip from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { fillNum, fmtDate } from "@/lib/format";
import { casesToCsv, filterCases, NO_CASE_FILTER, SAMPLE_STAFF, type CaseFilter } from "@/lib/office";
import { CATEGORIES } from "@/lib/categories";
import { type CaseRecord, type Status } from "@/lib/types";

const STATUSES: Status[] = ["received", "acknowledged", "referred", "resolved"];
const FILTERS_KEY = "jonokotha:office-filters:v1";
export const ASSIGN_KEY = "jonokotha:office-assign:v1";
type Saved = { name: string; f: CaseFilter };
const NO_SAVED: Saved[] = [];
const NO_ASSIGN: Record<string, string> = {};
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic";

/** Staff case table: filters, saved filters, bulk assign with confirmation, CSV export. Staff-only page (guardStaff). */
export default function CaseTable({ cases }: { cases: CaseRecord[] }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [f, setF] = useState<CaseFilter>(NO_CASE_FILTER);
  const [saved, setSaved] = useLocalValue(FILTERS_KEY, NO_SAVED);
  const [assign, setAssign] = useLocalValue(ASSIGN_KEY, NO_ASSIGN);
  const [name, setName] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [dlg, setDlg] = useState(false);
  const [who, setWho] = useState("");
  const rows = useMemo(() => filterCases(cases, f, assign), [cases, f, assign]);
  const staff = (id?: string) => SAMPLE_STAFF.find((s) => s.id === id)?.name ?? t.odUnassignedLabel;
  const allOn = rows.length > 0 && rows.every((r) => sel.includes(r.ref));
  const toggle = (ref: string) => setSel((s) => (s.includes(ref) ? s.filter((x) => x !== ref) : [...s, ref]));

  function exportCsv() {
    const csv = casesToCsv(rows, Object.fromEntries(rows.map((r) => [r.ref, assign[r.ref] ? staff(assign[r.ref]) : ""])), t.odCsvHeader.split(","));
    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "jonokotha-cases.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function confirmAssign() {
    if (!who) return;
    setAssign({ ...assign, ...Object.fromEntries(sel.map((r) => [r, who])) });
    toast("success", fillNum(t.odBulkDone, { n: sel.length }, lang));
    setSel([]); setWho(""); setDlg(false);
  }

  const assignedOpts = [{ value: "all", label: t.odAll }, { value: "mine-none", label: t.odUnassignedLabel }, ...SAMPLE_STAFF.map((s) => ({ value: s.id, label: s.name }))];
  return (
    <section aria-labelledby="cases-h" className="space-y-3">
      <h2 id="cases-h" className="text-xl font-semibold">{t.queue}</h2>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label={t.odSearch} type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <Select label={t.odStatus} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as CaseFilter["status"] })} options={[{ value: "all", label: t.odAll }, ...STATUSES.map((s) => ({ value: s, label: t.statuses[s] }))]} />
        <Select label={t.odCategory} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as CaseFilter["category"] })} options={[{ value: "all", label: t.odAll }, ...CATEGORIES.map((c) => ({ value: c, label: t.cats[c] }))]} />
        <Select label={t.odAssigned} value={f.assigned} onChange={(e) => setF({ ...f, assigned: e.target.value })} options={assignedOpts} />
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48"><Input label={t.odFilterName} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></div>
        <Button variant="secondary" disabled={!name.trim()} onClick={() => { setSaved([...saved.filter((s) => s.name !== name.trim()), { name: name.trim(), f }]); setName(""); }}>{t.odSaveFilter}</Button>
      </div>
      {saved.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">{t.odSavedFilters}</h3>
          <ul className="flex flex-wrap gap-2">
            {saved.map((s) => (
              <li key={s.name} className="inline-flex items-center gap-1 rounded-full border border-line bg-white ps-1">
                <Button variant="ghost" onClick={() => setF(s.f)} aria-label={`${t.odApply}: ${s.name}`}>{s.name}</Button>
                <Button variant="ghost" onClick={() => setSaved(saved.filter((x) => x.name !== s.name))} aria-label={`${t.odDeleteSaved}: ${s.name}`}>✕</Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t.odSavedLocal}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3" aria-live="polite">
        <span className="text-sm text-muted">{fillNum(t.odCountShown, { n: rows.length }, lang)}</span>
        {sel.length > 0 && <Badge tone="info">{fillNum(t.odSelected, { n: sel.length }, lang)}</Badge>}
        <Button variant="secondary" disabled={sel.length === 0} onClick={() => setDlg(true)}>{t.odBulkAssign}</Button>
        <Button variant="secondary" disabled={rows.length === 0} onClick={exportCsv}>{t.odExport}</Button>
      </div>
      <p className="text-xs text-muted">{t.odExportNote} {t.odAssignLocal}</p>

      {rows.length === 0 ? <p className="rounded-xl border border-line/40 bg-white p-4">{t.odNoRows}</p> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t.ofQueueAria}</caption>
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-5 accent-civic" checked={allOn} onChange={() => setSel(allOn ? [] : rows.map((r) => r.ref))} /><span className="sr-only">{t.odSelectAll}</span></label></th>
                {[t.ofColRef, t.ofColTitle, t.ofColCat, t.ofColArea, t.ofColStatus, t.odColAssigned, t.ofColDate].map((h) => <th key={h} scope="col" className="px-3 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.ref} className="hover:bg-slate-50">
                  <td className="px-3 py-1"><label className="flex min-h-11 items-center"><input type="checkbox" className="size-5 accent-civic" checked={sel.includes(c.ref)} onChange={() => toggle(c.ref)} /><span className="sr-only">{fillNum(t.odSelectRow, { ref: c.ref }, lang)}</span></label></td>
                  <td className="whitespace-nowrap px-3 py-1 text-slate-600">{c.ref}</td>
                  <td className="min-w-56 px-3 py-1 font-medium"><Link href={`/office/${c.ref}`} className={`inline-flex min-h-11 items-center text-civic underline ${focus}`}>{c.title}</Link></td>
                  <td className="whitespace-nowrap px-3 py-1 text-teal-strong">{t.cats[c.category]}</td>
                  <td className="px-3 py-1">{c.area || t.ofNoArea}</td>
                  <td className="px-3 py-1"><StatusChip status={c.status} label={t.statuses[c.status]} /></td>
                  <td className="whitespace-nowrap px-3 py-1">{staff(assign[c.ref])}</td>
                  <td className="whitespace-nowrap px-3 py-1 text-slate-600">{fmtDate(c.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dlg} onClose={() => setDlg(false)} title={fillNum(t.odBulkTitle, { n: sel.length }, lang)} description={t.odBulkBody}
        actions={<><Button variant="ghost" onClick={() => setDlg(false)}>{t.cpCancel}</Button><Button disabled={!who} onClick={confirmAssign}>{t.odBulkConfirm}</Button></>}>
        <Select label={t.odBulkPick} placeholder={t.odBulkPick} value={who} onChange={(e) => setWho(e.target.value)} options={SAMPLE_STAFF.map((s) => ({ value: s.id, label: s.name }))} />
      </Dialog>
    </section>
  );
}
