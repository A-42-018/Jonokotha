"use client";
import { useState } from "react";
import StatusChip from "@/components/ui/StatusChip";
import { useT } from "@/components/ui/useT";
import { useLang } from "@/components/ui/useLang";
import type { AuditEntry, OfficeAction, SubmitAction } from "@/lib/office-actions";
import type { Status } from "@/lib/types";
import AuditList from "./AuditList";
import OfficeActions from "./OfficeActions";

const NEXT: Record<OfficeAction, Status | null> = { acknowledge: "acknowledged", request_info: null, refer: "referred", resolve: "resolved" };
const STATUSES: Status[] = ["received", "acknowledged", "referred", "resolved"];

/** Review-only: all four actions against local state. Nothing is saved anywhere. */
export default function OfficeActionsDemo({ initial }: { initial: AuditEntry[] }) {
  const t = useT();
  const lang = useLang();
  const [status, setStatus] = useState<Status>("received");
  const [entries, setEntries] = useState<AuditEntry[]>(initial);
  const [fail, setFail] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const submit: SubmitAction = async () => {
    await new Promise((r) => setTimeout(r, 700));
    return forbidden ? "forbidden" : fail ? "fail" : "ok";
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2 lg:gap-6">
      <section className="min-w-0 space-y-4 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
              className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-civic ${status === s ? "border-civic bg-civic text-white" : "border-line"}`}>
              {t.statuses[s]}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-2 text-sm">JK-DEMO-0001 <StatusChip status={status} label={t.statuses[status]} /></p>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-5" checked={fail} onChange={(e) => setFail(e.target.checked)} />{t.oaDevFail}</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-5" checked={forbidden} onChange={(e) => setForbidden(e.target.checked)} />{t.oaDevForbidden}</label>
        <OfficeActions
          cref="JK-DEMO-0001"
          status={status}
          submit={submit}
          onDone={(action, note) => {
            setEntries((l) => [...l, { id: `n${l.length}`, actor: "Rahim Uddin", action, at: new Date().toISOString(), note }]);
            const next = NEXT[action];
            if (next) setStatus(next);
          }}
        />
      </section>
      <AuditList entries={entries} t={t} lang={lang} />
    </div>
  );
}
