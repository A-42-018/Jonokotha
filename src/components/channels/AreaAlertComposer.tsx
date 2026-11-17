"use client";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Card from "@/components/ui/Card";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { sendAreaAlert } from "@/lib/channels-api";

/** Office: send a short alert to the people who follow the area (F7.2, B7.4). Confirmed first; two a day per area on the server. */
export default function AreaAlertComposer(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const toast = useToast();
  const [f, setF] = useState({ bn: "", en: "", body: "" });
  const [err, setErr] = useState("");
  const key = useRef(crypto.randomUUID());
  const m = useMutation({
    mutationFn: () => sendAreaAlert({ constituency, title_bn: f.bn.trim(), ...(f.en.trim() ? { title_en: f.en.trim() } : {}), ...(f.body.trim() ? { body: f.body.trim() } : {}) }, key.current),
    onSuccess: () => { toast("success", t.aaSent); setF({ bn: "", en: "", body: "" }); key.current = crypto.randomUUID(); },
    onError: (e) => { key.current = crypto.randomUUID(); toast("error", e instanceof ApiError && (e.status === 429 || /limit/.test(e.fieldErrors._ ?? "")) ? t.aaLimit : e instanceof ApiError && e.status === 403 ? t.ckoNoAccess : t.r1FailMsg); },
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); setErr(""); };
  const ok = f.bn.trim().length >= 5;
  return (
    <Card as="section" title={t.aaTitle}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (!ok) setErr(t.aaShort); }} className="space-y-3">
        <p className="text-muted">{t.aaLead}</p>
        <Input label={t.aaTitleBn} maxLength={120} value={f.bn} error={err || undefined} onChange={set("bn")} />
        <Input label={t.aaTitleEn} optional maxLength={120} value={f.en} onChange={set("en")} />
        <Textarea label={t.aaBody} optional rows={3} maxLength={300} value={f.body} onChange={set("body")} />
        <ConfirmAction label={t.aaSend} body={t.aaConfirm} disabled={!ok} loading={m.isPending} onConfirm={() => m.mutateAsync()} />
      </form>
    </Card>
  );
}
