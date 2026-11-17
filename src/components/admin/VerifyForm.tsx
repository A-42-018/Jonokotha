"use client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { UUID_RE, verifyRepresentative, type RepStatus } from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";

export default function VerifyForm() {
  return <QueryProvider><VerifyInner /></QueryProvider>;
}

/** Verify, revoke or reset a representative by id. Verifying needs an official source link; the decision is audited. */
function VerifyInner() {
  const t = useT();
  const toast = useToast();
  const [id, setId] = useState("");
  const [status, setStatus] = useState<RepStatus>("verified");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [errs, setErrs] = useState<{ id?: string; source?: string }>({});
  const save = useMutation({
    mutationFn: () => verifyRepresentative(id.trim(), status, source, note),
    onSuccess: () => { toast("success", t.adVfDone); setId(""); setSource(""); setNote(""); },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 404 ? t.adVfNotFound : e instanceof ApiError && e.status === 403 ? t.ofToastForbidden : t.ofToastFail),
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const x = { id: UUID_RE.test(id.trim()) ? undefined : t.adVfBadId, source: status === "verified" && !/^https?:\/\//i.test(source.trim()) ? t.adVfNeedSource : undefined };
    setErrs(x);
    if (!x.id && !x.source) save.mutate();
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Card tone="info"><p className="text-sm">{t.adVfNoQueue}</p></Card>
      <Input label={t.adVfId} hint={t.adVfIdHint} value={id} error={errs.id} onChange={(e) => setId(e.target.value)} />
      <Select label={t.adVfStatus} value={status} onChange={(e) => setStatus(e.target.value as RepStatus)}
        options={[{ value: "verified", label: t.adVfVerified }, { value: "revoked", label: t.adVfRevoked }, { value: "pending", label: t.adVfPending }]} />
      <Input label={t.adVfSource} type="url" inputMode="url" value={source} error={errs.source} onChange={(e) => setSource(e.target.value)} />
      <Textarea label={t.adVfNote} optional rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" loading={save.isPending}>{t.adVfSubmit}</Button>
    </form>
  );
}
