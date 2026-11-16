"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { currentSubscription, disablePush, enablePush, fetchPrefs, pushSupport, quietError, savePrefs } from "@/lib/push";

/** Settings: push on this phone and quiet hours. Signed-in only. The alert text is fixed in public/sw.js and never holds report content. */
export default function PushSettings({ signedIn }: { signedIn: boolean }) {
  return <QueryProvider><PushInner signedIn={signedIn} /></QueryProvider>;
}

function PushInner({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: ["me-prefs"], queryFn: fetchPrefs, enabled: signedIn });
  const [support] = useState(() => pushSupport());
  const [here, setHere] = useState<boolean | null>(null); // is THIS device subscribed
  const [denied, setDenied] = useState(() => typeof Notification !== "undefined" && Notification.permission === "denied");
  const [unavailable, setUnavailable] = useState(false);
  // What the person has typed; until they touch it, the saved server values show.
  const [edit, setEdit] = useState<{ on?: boolean; from?: string; to?: string }>({});
  const saved = prefs.data?.quiet_hours ?? null;
  const quiet = edit.on ?? !!saved;
  const from = edit.from ?? saved?.start ?? "22:00";
  const to = edit.to ?? saved?.end ?? "07:00";
  const [quietErr, setQuietErr] = useState(false);

  useEffect(() => {
    let live = true;
    void currentSubscription().then((s) => { if (live) setHere(!!s); });
    return () => { live = false; };
  }, []);

  const on = useMutation({
    mutationFn: enablePush,
    onSuccess: (r) => {
      if (r === "on") { setHere(true); setDenied(false); toast("success", t.pushEnabledToast); void qc.invalidateQueries({ queryKey: ["me-prefs"] }); }
      else if (r === "denied") setDenied(true);
      else if (r === "unavailable") setUnavailable(true);
      else toast("error", t.pushUnsupported);
    },
    onError: () => toast("error", t.pushFail),
  });
  const off = useMutation({
    mutationFn: disablePush,
    onSuccess: () => { setHere(false); toast("success", t.pushDisabledToast); void qc.invalidateQueries({ queryKey: ["me-prefs"] }); },
    onError: () => toast("error", t.pushFail),
  });
  const saveQuiet = useMutation({
    mutationFn: () => savePrefs({ quiet_hours: quiet ? { start: from, end: to } : null }),
    onSuccess: () => { setEdit({}); toast("success", t.pushQuietSaved); void qc.invalidateQueries({ queryKey: ["me-prefs"] }); },
    onError: () => toast("error", t.pushQuietFail),
  });

  if (!signedIn) {
    return <Card title={t.pushTitle}><p className="mb-2 text-muted">{t.pushSignIn}</p><Link href="/login" className="inline-flex min-h-11 items-center text-civic underline">{t.signIn}</Link></Card>;
  }
  if (prefs.isPending) return <Card title={t.pushTitle}><p role="status" className="text-muted">{t.pushLoading}</p></Card>;
  if (prefs.isError) {
    return <Card title={t.pushTitle}><div role="alert" className="space-y-2"><p>{t.pushLoadError}</p><Button variant="secondary" onClick={() => void prefs.refetch()}>{t.pushRetry}</Button></div></Card>;
  }
  const serverOn = prefs.data.channels.push;
  const busy = on.isPending || off.isPending;
  return (
    <Card title={t.pushTitle}>
      <p className="mb-3 text-muted">{t.pushLead}</p>
      {support === "unsupported" ? <p role="status">{t.pushUnsupported}</p> : (
        <div className="space-y-3">
          <p role="status" className="font-medium">{here ? t.pushOn : t.pushOff}</p>
          {!here && serverOn && <p className="text-sm text-muted">{t.pushOtherDevice}</p>}
          {denied && <p role="alert" className="text-sm">{t.pushDenied}</p>}
          {unavailable && <p role="alert" className="text-sm">{t.pushUnavailable}</p>}
          {here
            ? <Button variant="secondary" loading={off.isPending} disabled={busy} onClick={() => off.mutate()}>{t.pushDisable}</Button>
            : <Button loading={on.isPending} disabled={busy || denied} onClick={() => { setUnavailable(false); on.mutate(); }}>{t.pushEnable}</Button>}
        </div>
      )}
      <fieldset className="mt-5 space-y-2 border-t border-line pt-4">
        <legend className="font-semibold">{t.pushQuietTitle}</legend>
        <p className="text-sm text-muted">{t.pushQuietLead}</p>
        <Checkbox label={t.pushQuietOn} checked={quiet} onChange={(e) => { setEdit({ ...edit, on: e.target.checked }); setQuietErr(false); }} />
        {quiet && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">{t.pushQuietFrom}<input type="time" value={from} onChange={(e) => { setEdit({ ...edit, from: e.target.value }); setQuietErr(false); }} className="mt-1 block min-h-11 rounded-lg border border-line bg-white px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-civic" /></label>
            <label className="block text-sm">{t.pushQuietTo}<input type="time" value={to} onChange={(e) => { setEdit({ ...edit, to: e.target.value }); setQuietErr(false); }} className="mt-1 block min-h-11 rounded-lg border border-line bg-white px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-civic" /></label>
          </div>
        )}
        {quietErr && <p role="alert" className="text-sm text-danger">{t.pushQuietBad}</p>}
        <Button variant="secondary" loading={saveQuiet.isPending} onClick={() => { if (quiet && quietError(from, to)) { setQuietErr(true); return; } saveQuiet.mutate(); }}>{t.pushQuietSave}</Button>
      </fieldset>
    </Card>
  );
}
