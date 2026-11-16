"use client";
import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import DataRights from "@/components/me/DataRights";
import Dialog from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { clearDeviceData, NOTIF_PREFS, NOTIF_PREFS_KEY } from "@/lib/settings";

/** Settings: language, in-app notification choices (device-local), account, clear device data. */
export default function SettingsPanel({ email, role }: { email: string | null; role: string | null }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [prefs, setPrefs] = useLocalValue(NOTIF_PREFS_KEY, NOTIF_PREFS);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-4">
      <Card title={t.stLang}>
        <p className="mb-2">{lang === "bn" ? t.stLangNow : "Now: English"}</p>
        <a href="/lang" className="inline-flex min-h-11 items-center rounded-xl border border-civic px-4 font-medium text-civic focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">{t.stLangSwitch}</a>
      </Card>
      <Card title={t.stNotif}>
        <Checkbox label={t.stNotifStatus} checked={prefs.status} onChange={(e) => setPrefs({ ...prefs, status: e.target.checked })} />
        <Checkbox label={t.stNotifReply} checked={prefs.reply} onChange={(e) => setPrefs({ ...prefs, reply: e.target.checked })} />
        <Checkbox label={t.stNotifArea} checked={prefs.area} onChange={(e) => setPrefs({ ...prefs, area: e.target.checked })} />
        <Checkbox label={t.stNotifPush} hint={t.stNotifPushSoon} checked={false} disabled readOnly />
        <p className="mt-2 text-sm text-muted">{t.stNotifLocal}</p>
      </Card>
      <Card title={t.stAccount}>
        {email ? <p className="break-all font-medium">{email}{role ? ` · ${role}` : ""}</p> : (
          <div className="space-y-2"><p className="text-muted">{t.stSignedOut}</p><Link href="/login" className="inline-flex min-h-11 items-center text-civic underline">{t.signIn}</Link></div>
        )}
      </Card>
      <DataRights signedIn={!!email} />
      <Card title={t.stData}>
        <p className="mb-3 text-muted">{t.stDataBody}</p>
        <Button variant="danger" onClick={() => setConfirm(true)}>{t.stClear}</Button>
      </Card>
      <Card title={t.stLinks}>
        <ul className="space-y-1">
          <li><Link href="/help" className="inline-flex min-h-11 items-center text-civic underline">{t.hpTitle}</Link></li>
          <li><Link href="/privacy" className="inline-flex min-h-11 items-center text-civic underline">{t.hpPrivacyLink}</Link></li>
          <li><Link href="/terms" className="inline-flex min-h-11 items-center text-civic underline">{t.lgToTerms}</Link></li>
          <li><Link href="/challenge" className="inline-flex min-h-11 items-center text-civic underline">{t.lgToChallenge}</Link></li>
        </ul>
      </Card>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t.stClearTitle} description={t.stClearBody}
        actions={<><Button variant="ghost" onClick={() => setConfirm(false)}>{t.stClearNo}</Button><Button variant="danger" onClick={() => { clearDeviceData(); setConfirm(false); toast("success", t.stCleared); }}>{t.stClearYes}</Button></>} />
    </div>
  );
}
