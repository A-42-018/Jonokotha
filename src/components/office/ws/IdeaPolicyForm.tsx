"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Card from "@/components/ui/Card";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fillNum } from "@/lib/format";
import { fetchPolicy, policyErrors, savePolicy } from "@/lib/ideas-r11-api";
import Boundary from "./Boundary";

/** Office setting: support threshold and answer time for ideas in the area (F7.5, B7.5). Citizens see both numbers. */
export default function IdeaPolicyForm(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["idea-policy", constituency], queryFn: () => fetchPolicy(constituency), retry: false });
  if (q.data?.kind === "planned") return <PlannedPanel title={t.ipTitle} body={t.r1PlannedBody} />;
  return (
    <Card as="section" title={t.ipTitle}>
      <p className="mb-3 text-muted">{t.ipLead}</p>
      <Boundary q={q} emptyTitle={t.ipNone}>
        {(d) => d.kind === "ok" ? <Form constituency={constituency} start={d.data} /> : null}
      </Boundary>
    </Card>
  );
}

function Form({ constituency, start }: { constituency: string; start: { support_threshold: number | null; response_days: number | null } }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [th, setTh] = useState(start.support_threshold?.toString() ?? "");
  const [days, setDays] = useState(start.response_days?.toString() ?? "");
  const all = policyErrors(th, days);
  const bad = { threshold: th.trim() !== "" && all.threshold, days: days.trim() !== "" && all.days };
  const m = useMutation({
    mutationFn: () => savePolicy(constituency, { support_threshold: Number(th), response_days: Number(days) }),
    onSuccess: () => { toast("success", t.ipSaved); void qc.invalidateQueries({ queryKey: ["idea-policy", constituency] }); },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 403 ? t.ipNoAccess : t.r1FailMsg),
  });
  const ok = Object.keys(all).length === 0;
  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-3">
      <p className="text-sm" role="status">{start.support_threshold === null ? t.ipNone : fillNum(t.ipCurrent, { t: start.support_threshold, d: start.response_days ?? 0 }, lang)}</p>
      <Input label={t.ipThreshold} inputMode="numeric" value={th} error={bad.threshold ? t.ipBad : undefined} onChange={(e) => setTh(e.target.value)} />
      <Input label={t.ipDays} inputMode="numeric" value={days} error={bad.days ? t.ipBad : undefined} onChange={(e) => setDays(e.target.value)} />
      <ConfirmAction label={t.ipSave} body={t.ipConfirm} disabled={!ok} loading={m.isPending} onConfirm={() => m.mutateAsync()} />
    </form>
  );
}
