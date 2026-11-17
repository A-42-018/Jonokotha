"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Select from "@/components/ui/Select";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fmtDate } from "@/lib/format";
import { fetchOfficeIssues } from "@/lib/office-workspace-api";
import Boundary, { label } from "./Boundary";

/** Case list from GET /office/issues: "mine" is assigned=me, "all" the whole queue the office may see (RLS decides). */
export default function CasesPanel(props: { mode: "mine" | "all" }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ mode }: { mode: "mine" | "all" }) {
  const t = useT();
  const lang = useLang();
  const [f, setF] = useState<"all" | "none">("all");
  const assigned = mode === "mine" ? "me" : f === "none" ? "none" : undefined;
  const q = useQuery({ queryKey: ["office-issues", assigned ?? "all"], queryFn: () => fetchOfficeIssues(assigned), retry: false });
  return (
    <div className="space-y-4">
      {mode === "all" && (
        <div className="max-w-xs">
          <Select label={t.odAssigned} value={f} onChange={(e) => setF(e.target.value === "none" ? "none" : "all")}
            options={[{ value: "all", label: t.owFilterAll }, { value: "none", label: t.owFilterNone }]} />
        </div>
      )}
      <Boundary q={q} isEmpty={(d) => d.length === 0} emptyTitle={mode === "mine" ? t.owMineEmpty : t.owAllEmpty}>
        {(rows) => (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.ref} className="rounded-2xl border border-line bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">{t.owColRef}: <span dir="ltr">{r.ref}</span></span>
                  <Badge tone="info">{label(t, "owSt_", r.status)}</Badge>
                  {r.is_sample && <Badge>{t.owSample}</Badge>}
                </div>
                <h2 className="mt-1 text-lg font-semibold">{r.title}</h2>
                <p className="text-sm text-muted">{t.owColUpdated}: {fmtDate(r.updated_at, lang)}</p>
                <Link href={`/office/${encodeURIComponent(r.ref)}`} className="mt-1 inline-flex min-h-11 items-center text-civic underline">{t.owOpenCase}<span className="sr-only">: {r.title}</span></Link>
              </li>
            ))}
          </ul>
        )}
      </Boundary>
      <div className="grid gap-3 md:grid-cols-3">
        <PlannedPanel as="h2" title={t.owAffectedTitle} body={t.owAffectedBody} />
        <PlannedPanel as="h2" title={t.owAppealTitle} body={t.owAppealBody} />
        <PlannedPanel as="h2" title={t.owEvidenceTitle} body={t.owEvidenceBody} />
      </div>
    </div>
  );
}
