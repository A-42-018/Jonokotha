"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum, fmtDate } from "@/lib/format";
import { createOfficeReport, fetchOfficeReports, setReportStatus } from "@/lib/office-workspace-api";
import Boundary, { label, saveError } from "./Boundary";
import InsightBriefs from "./InsightBriefs";

export default function ReportsPanel({ constituency }: { constituency: string }) {
  return <QueryProvider><Inner constituency={constituency} /></QueryProvider>;
}

const DAYS = ["30", "90", "180"];

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["office-reports"], queryFn: fetchOfficeReports, retry: false });
  const [days, setDays] = useState("30");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["office-reports"] }); };
  const create = useMutation({
    mutationFn: () => createOfficeReport(constituency, Number(days), key),
    onSuccess: () => { toast("success", t.owSaved); setKey(crypto.randomUUID()); refresh(); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  const decide = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "withdraw" }) => setReportStatus(v.id, v.action),
    onSuccess: () => { toast("success", t.owSaved); refresh(); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  return (
    <div className="space-y-4">
      <Link href="/office/kpis" className="inline-flex min-h-11 items-center text-civic underline">{t.owAnKpiLink}</Link>
      <section aria-labelledby="an-r" className="space-y-3">
        <h2 id="an-r" className="text-xl font-semibold">{t.owAnReports}</h2>
        <p className="text-muted">{t.owAnReportsLead}</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <Select label={t.owAnDays} value={days} onChange={(e) => setDays(e.target.value)} options={DAYS.map((d) => ({ value: d, label: fillNum(t.owAnPeriod, { n: Number(d) }, lang) }))} />
          <Button type="submit" disabled={create.isPending}>{t.owAnCreate}</Button>
        </form>
        <Boundary q={q} isEmpty={(d) => d.length === 0} emptyTitle={t.owAnEmpty}>
          {(rows) => (
            <ul className="space-y-2">{rows.map((r) => (
              <li key={r.id} className="space-y-2 rounded-2xl border border-line bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === "approved" ? "success" : "neutral"}>{label(t, "owAnStatus_", r.status)}</Badge>
                  <span className="text-sm text-muted">{fillNum(t.owAnPeriod, { n: r.period_days }, lang)} · {fmtDate(r.created_at, lang)}</span>
                </div>
                {r.narrative && <p className="whitespace-pre-line">{r.narrative}</p>}
                <div className="flex flex-wrap gap-2">
                  {r.status === "draft" && <Button disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, action: "approve" })}>{t.owAnApprove}</Button>}
                  {r.status === "approved" && <Button variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, action: "withdraw" })}>{t.owAnWithdraw}</Button>}
                </div>
                {r.status === "draft" && <p className="text-sm text-muted">{t.owAnApproveWarn}</p>}
              </li>
            ))}</ul>
          )}
        </Boundary>
      </section>
      <InsightBriefs />
    </div>
  );
}
