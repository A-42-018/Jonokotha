"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fmtDate } from "@/lib/format";
import { fetchInvitations, invite, MANAGER_INVITE_ROLES, revokeInvitation, type InviteRole } from "@/lib/office-workspace-api";
import Boundary, { label, saveError } from "./Boundary";

export default function StaffPanel({ constituency }: { constituency: string }) {
  return <QueryProvider><Inner constituency={constituency} /></QueryProvider>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["office-invitations"], queryFn: fetchInvitations, retry: false });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("case_officer");
  const [err, setErr] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["office-invitations"] }); };
  const send = useMutation({
    mutationFn: () => invite(email, constituency, role, key),
    onSuccess: () => { toast("success", t.owSaved); setEmail(""); setKey(crypto.randomUUID()); refresh(); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => { toast("success", t.owSaved); refresh(); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  return (
    <div className="space-y-4">
      <form noValidate className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); if (!EMAIL.test(email.trim())) { setErr(t.owStaffEmailBad); return; } setErr(""); send.mutate(); }}>
        <Input label={t.owStaffEmail} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} error={err || undefined} />
        <Select label={t.owStaffRole} value={role} onChange={(e) => setRole(e.target.value as InviteRole)} options={MANAGER_INVITE_ROLES.map((r) => ({ value: r, label: label(t, "owRole_", r) }))} />
        <Button type="submit" disabled={send.isPending}>{t.owStaffSend}</Button>
      </form>
      <Boundary q={q} isEmpty={(d) => d.length === 0} emptyTitle={t.owStaffEmpty}>
        {(rows) => (
          <ul className="space-y-2">{rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-3">
              <span dir="ltr" className="font-medium">{r.email}</span>
              <Badge>{label(t, "owRole_", r.office_role)}</Badge>
              <Badge tone="info">{label(t, "owInv_", r.status)}</Badge>
              <span className="text-sm text-muted">{t.owStaffExpires}: {fmtDate(r.expires_at, lang)}</span>
              {r.status === "pending" && <Button variant="secondary" disabled={revoke.isPending} onClick={() => revoke.mutate(r.id)}>{t.owStaffRevoke}<span className="sr-only">: {r.email}</span></Button>}
            </li>
          ))}</ul>
        )}
      </Boundary>
      <PlannedPanel as="h2" title={t.owStaffRolesTitle} body={t.owStaffRolesBody} />
    </div>
  );
}
