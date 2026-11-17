"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Boundary from "@/components/office/ws/Boundary";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import Table, { type Column } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fmtNum } from "@/lib/format";
import { fetchMyRegions, fetchRegionalAdmins, fetchRegionOverview, grantRegionalAdmin, revokeRegionalAdmin, type RegionalAdminRow } from "@/lib/r2-api";
import type { RegionalArea } from "@/lib/types";
import { Gate, useR2Fail } from "./bits";

/** Regional administration (F8.5): counts per area inside the person's scope. The areas are listed in alphabetical order on purpose, never ranked. */
export function RegionOverview() {
  return <QueryProvider><Overview /></QueryProvider>;
}

function Overview() {
  const t = useT();
  const lang = useLang();
  const mine = useQuery({ queryKey: ["my-regions"], queryFn: fetchMyRegions, retry: false });
  const hasUnits = mine.data?.kind === "ok" && mine.data.data.length > 0;
  // Only an account with a region may ask for the counts; anyone else would get a 403, so they see the "no region" state instead.
  const q = useQuery({ queryKey: ["region-overview"], queryFn: () => fetchRegionOverview(), retry: false, enabled: hasUnits });
  const n = (v: number) => fmtNum(v, lang);
  const cols: Column<RegionalArea>[] = [
    { key: "a", header: t.r2RgArea, primary: true, cell: (r) => <span>{lang === "bn" ? r.name_bn : r.name_en}{r.is_sample && <> <Badge tone="neutral">{t.r2Sample}</Badge></>}</span> },
    { key: "o", header: t.r2RgOpen, align: "end", cell: (r) => n(r.open_issues) },
    { key: "n", header: t.r2RgNew, align: "end", cell: (r) => n(r.new_30d) },
    { key: "r", header: t.r2RgResolved, align: "end", cell: (r) => n(r.resolved_30d) },
    { key: "d", header: t.r2RgOverdue, align: "end", cell: (r) => n(r.overdue_first_response) },
    { key: "s", header: t.r2RgStaff, align: "end", cell: (r) => n(r.active_staff) },
    { key: "m", header: t.r2RgMp, cell: (r) => (r.has_mp ? t.r2RgMpYes : t.r2RgMpNo) },
  ];
  return (
    <Boundary q={mine} emptyTitle={t.r2RgNoScope}>
      {(m) => <Gate data={m}>
      {(units) => (
        <div className="space-y-3">
          {units.length > 0 && <p className="text-sm text-muted">{t.r2RgUnits}: {units.map((u) => (lang === "bn" ? u.name_bn : u.name_en)).join(", ")}</p>}
          {units.length === 0 ? <p role="status" className="text-muted">{t.r2RgNoScope}</p> : (
          <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.areas.length === 0} emptyTitle={t.r2RgNoScope}>
            {(d) => d.kind === "ok" ? <Table caption={t.r2RgTitle} columns={cols} rows={[...d.data.areas].sort((a, b) => a.name_en.localeCompare(b.name_en))} rowKey={(r) => r.constituency} /> : null}
          </Boundary>
          )}
          <p className="text-sm text-muted">{t.r2RgNotRank}</p>
        </div>
      )}
      </Gate>}
    </Boundary>
  );
}

/** Admin: give a staff account the counts of one region, or take them away. */
export function RegionalAdmins() {
  return <QueryProvider><Admins /></QueryProvider>;
}

function Admins() {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const q = useQuery({ queryKey: ["regional-admins"], queryFn: fetchRegionalAdmins, retry: false });
  const [f, setF] = useState({ user: "", unit: "", level: "" });
  const ok = /^[0-9a-f-]{36}$/i.test(f.user.trim()) && f.unit.trim().length > 0 && f.level.trim().length > 0;
  const grant = useMutation({ mutationFn: () => grantRegionalAdmin({ user_id: f.user.trim(), unit_code: f.unit.trim(), level: f.level.trim() }), onSuccess: () => { toast("success", t.r2Done); setF({ user: "", unit: "", level: "" }); void qc.invalidateQueries({ queryKey: ["regional-admins"] }); }, onError: fail });
  const revoke = useMutation({ mutationFn: (id: string) => revokeRegionalAdmin(id), onSuccess: () => { toast("success", t.r2Done); void qc.invalidateQueries({ queryKey: ["regional-admins"] }); }, onError: fail });
  return (
    <Gate data={q.data}>
      {() => (
        <div className="space-y-4">
          <form noValidate onSubmit={(e) => { e.preventDefault(); if (ok) grant.mutate(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
            <Input label={t.r2RgUser} value={f.user} onChange={(e) => setF((s) => ({ ...s, user: e.target.value }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label={t.r2RgUnit} value={f.unit} onChange={(e) => setF((s) => ({ ...s, unit: e.target.value }))} />
              <Input label={t.r2RgLevel} value={f.level} onChange={(e) => setF((s) => ({ ...s, level: e.target.value }))} />
            </div>
            <Button type="submit" disabled={!ok} loading={grant.isPending}>{t.r2RgGrant}</Button>
          </form>
          <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.r2Empty}>
            {(d) => d.kind === "ok" ? (
              <ul className="space-y-2">{d.data.filter((r: RegionalAdminRow) => r.status === "active").map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3">
                  <span className="min-w-0 break-all">{r.unit_name_en} ({r.unit_code}) · {r.user_id}</span>
                  <ConfirmAction label={t.r2RgRevoke} variant="danger" body={t.r2RgRevokeBody} loading={revoke.isPending} onConfirm={() => revoke.mutateAsync(r.id)} />
                </li>
              ))}</ul>
            ) : null}
          </Boundary>
        </div>
      )}
    </Gate>
  );
}
