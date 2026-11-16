"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { cancelDeletion, consentOpen, currentConsent, downloadExport, fetchConsents, fetchProfile, POLICY_VERSION, requestDeletion, setConsent } from "@/lib/legal";
import { fillNum, fmtDate } from "@/lib/format";

/** Settings: download my data, request or cancel account deletion, privacy-notice consent. Signed-in only; acts on the person's own data. */
export default function DataRights({ signedIn }: { signedIn: boolean }) {
  return <QueryProvider><DataInner signedIn={signedIn} /></QueryProvider>;
}

function DataInner({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const profile = useQuery({ queryKey: ["me-profile"], queryFn: fetchProfile, enabled: signedIn });
  const consents = useQuery({ queryKey: ["me-consents"], queryFn: fetchConsents, enabled: signedIn });

  const exp = useMutation({
    mutationFn: () => downloadExport(),
    onSuccess: () => toast("success", t.dtExported),
    onError: (e) => toast("error", e instanceof ApiError && e.status === 429 ? t.dtTooMany : t.dtExportFail),
  });
  const del = useMutation({
    mutationFn: requestDeletion,
    onSuccess: () => { setConfirm(false); toast("success", t.dtDeleteDone); void qc.invalidateQueries({ queryKey: ["me-profile"] }); },
    onError: () => { setConfirm(false); toast("error", t.dtDeleteFail); },
  });
  const cancel = useMutation({
    mutationFn: cancelDeletion,
    onSuccess: () => { toast("success", t.dtCancelled); void qc.invalidateQueries({ queryKey: ["me-profile"] }); },
    onError: () => toast("error", t.dtCancelFail),
  });
  const consent = useMutation({
    mutationFn: (granted: boolean) => setConsent(granted),
    onSuccess: () => { toast("success", t.dtConsentSaved); void qc.invalidateQueries({ queryKey: ["me-consents"] }); },
    onError: () => toast("error", t.dtConsentFail),
  });

  if (!signedIn) {
    return (
      <Card title={t.dtTitle}>
        <p className="mb-2 text-muted">{t.dtSignIn}</p>
        <Link href="/login" className="inline-flex min-h-11 items-center text-civic underline">{t.signIn}</Link>
      </Card>
    );
  }
  if (profile.isPending || consents.isPending) return <Card title={t.dtTitle}><p role="status" className="text-muted">{t.dtLoading}</p></Card>;
  if (profile.isError || consents.isError) {
    return (
      <Card title={t.dtTitle}>
        <div role="alert" className="space-y-2"><p>{t.dtLoadFail}</p><Button variant="secondary" onClick={() => { void profile.refetch(); void consents.refetch(); }}>{t.dtRetry}</Button></div>
      </Card>
    );
  }

  const pending = profile.data.deletion_requested_at;
  const row = currentConsent(consents.data);
  const open = consentOpen(row);
  const current = open && row?.policy_version === POLICY_VERSION;
  return (
    <>
      <Card title={t.dtExportTitle}>
        <p className="mb-3 text-muted">{t.dtExportBody}</p>
        <Button variant="secondary" loading={exp.isPending} onClick={() => exp.mutate()}>{exp.isPending ? t.dtExporting : t.dtExport}</Button>
      </Card>
      <Card title={t.dtConsentTitle}>
        <p className="mb-2 text-muted">{fillNum(t.dtConsentBody, { v: POLICY_VERSION }, lang)}</p>
        <p className="mb-3 font-medium">{current && row ? fillNum(t.dtConsentGiven, { date: fmtDate(row.granted_at, lang) }, lang) : t.dtConsentNone}</p>
        {open && !current && <p className="mb-3 text-sm text-muted">{t.dtConsentOld}</p>}
        <Button variant={current ? "ghost" : "secondary"} loading={consent.isPending} onClick={() => consent.mutate(!current)}>{current ? t.dtConsentWithdraw : t.dtConsentGive}</Button>
      </Card>
      <Card title={t.dtDeleteTitle} tone={pending ? "warning" : "default"}>
        <p className="mb-3 text-muted">{t.dtDeleteBody}</p>
        {pending ? (
          <div className="space-y-3">
            <p role="status" className="font-medium">{fillNum(t.dtPending, { date: fmtDate(pending, lang) }, lang)}</p>
            <Button variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate()}>{t.dtCancel}</Button>
          </div>
        ) : <Button variant="danger" onClick={() => setConfirm(true)}>{t.dtDelete}</Button>}
      </Card>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t.dtDeleteConfirmTitle} description={t.dtDeleteConfirmBody} busy={del.isPending}
        actions={<><Button variant="ghost" onClick={() => setConfirm(false)}>{t.dtDeleteNo}</Button><Button variant="danger" loading={del.isPending} onClick={() => del.mutate()}>{t.dtDeleteYes}</Button></>} />
    </>
  );
}
