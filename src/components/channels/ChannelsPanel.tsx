"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Checkbox, RadioGroup } from "@/components/ui/Choice";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fetchChannels, phoneOk, removeLink, setUpdates, showNumber, startLink, toE164, waLink, type ChannelKind, type ChannelLink, type LinkStarted } from "@/lib/channels-api";
import { fillNum, fmtDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";

/** Settings: link a phone number for WhatsApp or SMS, choose whether updates go there, remove it (F7.2, B7.2/B7.4). Consent comes first, and removing withdraws it. */
export default function ChannelsPanel({ signedIn }: { signedIn: boolean }) {
  return <QueryProvider><Inner signedIn={signedIn} /></QueryProvider>;
}

function Inner({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const q = useQuery({ queryKey: ["channels"], queryFn: fetchChannels, enabled: signedIn, retry: false });
  if (!signedIn) return <Card title={t.chpTitle}><p className="mb-2 text-muted">{t.chpSignIn}</p><Link href="/login?need=1&next=%2Fsettings" className="inline-flex min-h-11 items-center text-civic underline">{t.signIn}</Link></Card>;
  if (q.data?.kind === "planned") return <PlannedPanel title={t.chpPlanned} body={t.r1PlannedBody} />;
  return (
    <Card as="section" title={t.chpTitle} className="space-y-3">
      <p className="text-muted">{t.chpLead}</p>
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
        {q.data?.kind === "ok" && (
          <>
            {q.data.data.length === 0 ? <p>{t.chpEmpty}</p> : <ul className="space-y-3">{q.data.data.map((l) => <li key={l.id}><LinkRow link={l} /></li>)}</ul>}
            <LinkForm taken={q.data.data.map((l) => l.channel)} />
          </>
        )}
      </AsyncBlock>
    </Card>
  );
}

function LinkRow({ link }: { link: ChannelLink }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ["channels"] });
  const upd = useMutation({ mutationFn: (on: boolean) => setUpdates(link, on), onSuccess: (_d, on) => { toast("success", on ? t.chpUpdatesOn : t.chpUpdatesOff); refresh(); }, onError: () => toast("error", t.chpFail) });
  const del = useMutation({ mutationFn: () => removeLink(link.id), onSuccess: () => { toast("success", t.chpRemoved); refresh(); }, onError: () => toast("error", t.chpFail) });
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{t[`chpChannel_${link.channel}` as "chpChannel_sms"]}</strong>
        <Badge tone={link.status === "active" ? "success" : "warning"} icon={link.status === "active" ? "✓" : "⏳"}>{t[`chpStatus_${link.status === "active" ? "active" : "pending"}` as "chpStatus_active"]}</Badge>
        <span className="text-sm text-muted">{fillNum(t.chpHint, { hint: link.address_hint }, lang)}</span>
      </div>
      {link.status === "pending" && link.code_expires_at && <p className="text-sm text-muted">{fillNum(t.chpExpires, { date: fmtDate(link.code_expires_at, lang) }, lang)}</p>}
      {link.status === "active" && <Checkbox label={t.chpUpdates} hint={t.chpUpdatesNote} checked={link.updates_enabled} disabled={upd.isPending} onChange={(e) => upd.mutate(e.target.checked)} />}
      <ConfirmAction variant="secondary" label={t.chpRemove} body={t.chpRemoveConfirm} loading={del.isPending} onConfirm={() => del.mutateAsync()} />
    </div>
  );
}

function LinkForm({ taken }: { taken: ChannelKind[] }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const name = useId();
  const free = (["whatsapp", "sms"] as ChannelKind[]).filter((c) => !taken.includes(c));
  const [picked, setChannel] = useState<ChannelKind>(free[0] ?? "whatsapp");
  const channel = free.includes(picked) ? picked : (free[0] ?? picked);   // after one number is linked the other channel is the only one left
  const [phone, setPhone] = useState("");
  const [accept, setAccept] = useState(false);
  const [err, setErr] = useState<{ phone?: string; accept?: string; form?: string }>({});
  const [started, setStarted] = useState<LinkStarted | null>(null);
  const key = useRef(crypto.randomUUID());
  const m = useMutation({
    mutationFn: () => startLink(channel, toE164(phone), key.current),
    onSuccess: (r) => { setStarted(r); setPhone(""); setAccept(false); key.current = crypto.randomUUID(); void qc.invalidateQueries({ queryKey: ["channels"] }); toast("success", t.chpCodeTitle); },
    onError: (e) => {
      key.current = crypto.randomUUID();
      const d = e instanceof ApiError ? e.fieldErrors._ : "";
      setErr({ form: d === "address_in_use" ? t.chpInUse : d === "link_limit" || (e instanceof ApiError && e.status === 429) ? t.chpLimit : t.chpFail });
    },
  });
  if (free.length === 0 && !started) return null;
  return (
    <div className="space-y-3 border-t border-line pt-3">
      {started && <CodeBox s={started} channel={channel} />}
      {free.length > 0 && (
        <form noValidate onSubmit={(e) => { e.preventDefault(); const x: typeof err = {}; if (!phoneOk(phone)) x.phone = t.chpPhoneBad; if (!accept) x.accept = t.chpAcceptNeeded; setErr(x); if (!x.phone && !x.accept) m.mutate(); }} className="space-y-3">
          <h3 className="font-semibold">{t.chpAdd}</h3>
          <RadioGroup legend={t.chpWhich} name={name} value={channel} onChange={(v) => setChannel(v as ChannelKind)} options={free.map((c) => ({ value: c, label: t[`chpChannel_${c}` as "chpChannel_sms"] }))} />
          <Input label={t.chpPhone} hint={t.chpPhoneHint} inputMode="tel" autoComplete="tel" value={phone} error={err.phone} onChange={(e) => setPhone(e.target.value)} />
          <Checkbox label={t.chpAccept} checked={accept} error={err.accept} onChange={(e) => setAccept(e.target.checked)} />
          <p className="text-sm"><Link href="/privacy" className="text-civic underline">{t.chpPrivacyLink}</Link></p>
          {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
          <Button type="submit" loading={m.isPending}>{t.chpLink}</Button>
        </form>
      )}
    </div>
  );
}

function CodeBox({ s, channel }: { s: LinkStarted; channel: ChannelKind }) {
  const t = useT();
  const to = showNumber(s.send_to ?? "");
  const wa = channel === "whatsapp" && s.send_to ? waLink(s.send_to, s.code) : null;
  return (
    <Card tone="info" title={t.chpCodeTitle} headingAs="h3">
      <p>{t.chpCodeBody}</p>
      <p className="my-2 text-sm text-muted">{t.chpCodeLabel}</p>
      <p className="select-all break-all font-mono text-2xl font-semibold tracking-wider" data-testid="link-code">{s.code}</p>
      <p className="mt-2">{to ? fillNum(t.chpCodeSendTo, { to }, "en") : t.chpCodeNoNumber}</p>
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-civic underline">{t.chnOpenWa}</a>}
    </Card>
  );
}
