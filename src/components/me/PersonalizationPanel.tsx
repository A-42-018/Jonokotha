"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import Dialog from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { usePersonalModes } from "@/components/ui/usePersonalization";
import { useT } from "@/components/ui/useT";
import { CATEGORIES } from "@/lib/categories";
import { fetchFollows, removeFollow, type FollowRow } from "@/lib/engagement-api";
import { DEFAULT_MODES, FEED_PERSONAL_KEY } from "@/lib/personalize";
import { fetchPrefs, savePrefs, type Prefs } from "@/lib/push";

/** Settings: personalization controls (F5.15). View what the feed uses, switch it off, switch the two reading modes, reset. */
export default function PersonalizationPanel({ signedIn }: { signedIn: boolean }) {
  return <QueryProvider><Inner signedIn={signedIn} /></QueryProvider>;
}

function Inner({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const [modes, setModes] = usePersonalModes();
  const [, setFeedLocal] = useLocalValue<boolean>(FEED_PERSONAL_KEY, true);
  const [confirm, setConfirm] = useState(false);
  const prefs = useQuery({ queryKey: ["me-prefs-types"], queryFn: fetchPrefs, enabled: signedIn });
  const follows = useQuery({ queryKey: ["follows"], queryFn: fetchFollows, enabled: signedIn });

  const saveFeed = useMutation({
    mutationFn: (on: boolean) => savePrefs({ personalization_enabled: on }),
    onMutate: async (on) => {
      await qc.cancelQueries({ queryKey: ["me-prefs-types"] });
      const before = qc.getQueryData<Prefs>(["me-prefs-types"]);
      if (before) qc.setQueryData<Prefs>(["me-prefs-types"], { ...before, personalization_enabled: on });
      return { before };
    },
    onError: (_e, _on, ctx) => { if (ctx?.before) qc.setQueryData(["me-prefs-types"], ctx.before); toast("error", t.pzFeedFail); },
    onSuccess: (_d, on) => { setFeedLocal(on); toast("success", t.pzFeedSaved); },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const rows = await fetchFollows();
      const res = await Promise.allSettled(rows.map((f) => removeFollow(f.id)));
      const failed = res.filter((r) => r.status === "rejected").length;
      if (failed === 0) await savePrefs({ personalization_enabled: true });
      return failed;
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ["follows"] }); void qc.invalidateQueries({ queryKey: ["me-prefs-types"] }); },
    onSuccess: (failed) => {
      setConfirm(false);
      if (failed > 0) { toast("error", t.pzResetPartial); return; }
      setModes(DEFAULT_MODES);
      setFeedLocal(true);
      toast("success", t.pzResetDone);
    },
    onError: () => { setConfirm(false); toast("error", t.pzResetPartial); },
  });

  const label = (f: FollowRow) => (f.type === "category" && (CATEGORIES as readonly string[]).includes(f.target) ? t.cats[f.target as (typeof CATEGORIES)[number]] : (f.label ?? f.target));

  return (
    <Card title={t.pzTitle}>
      <p className="mb-3 text-muted">{t.pzLead}</p>

      <fieldset className="min-w-0 border-0 p-0">
        <legend className="mb-1 font-semibold">{t.pzDeviceHead}</legend>
        <Checkbox label={t.pzSimple} hint={t.pzSimpleHint} checked={modes.simple} onChange={(e) => setModes({ ...modes, simple: e.target.checked })} />
        <Checkbox label={t.pzVoice} hint={t.pzVoiceHint} checked={modes.voiceFirst} onChange={(e) => setModes({ ...modes, voiceFirst: e.target.checked })} />
        <p className="mt-1 text-sm text-muted">{t.pzDeviceNote}</p>
      </fieldset>

      <div className="mt-4 space-y-2 border-t border-line/40 pt-3">
        <h3 className="font-semibold">{t.pzFeedHead}</h3>
        {!signedIn ? (
          <div className="space-y-2"><p className="text-muted">{t.pzSignIn}</p><Link href="/login" className="inline-flex min-h-11 items-center text-civic underline">{t.signIn}</Link></div>
        ) : prefs.isPending ? <p role="status" className="text-muted">{t.pzFollowLoading}</p>
        : prefs.isError ? (
          <div role="alert" className="space-y-2"><p>{t.pzFollowError}</p><Button variant="secondary" onClick={() => void prefs.refetch()}>{t.pzRetry}</Button></div>
        ) : (
          <>
            <Checkbox label={t.pzFeedOn} hint={t.pzFeedOnHint} checked={prefs.data.personalization_enabled} disabled={saveFeed.isPending}
              onChange={(e) => saveFeed.mutate(e.target.checked)} />
            <p className="text-sm">{t.pzFeedUses}</p>
            {follows.isPending ? <p role="status" className="text-sm text-muted">{t.pzFollowLoading}</p>
            : follows.isError ? <div role="alert" className="space-y-2 text-sm"><p>{t.pzFollowError}</p><Button variant="secondary" onClick={() => void follows.refetch()}>{t.pzRetry}</Button></div>
            : follows.data.length === 0 ? <p className="text-sm text-muted">{t.pzFollowNone}</p>
            : (
              <ul className="flex flex-wrap gap-2">
                {follows.data.map((f) => (
                  <li key={f.id} className="rounded-full border border-line bg-white px-3 py-1 text-sm"><span className="text-muted">{t[`pzType_${f.type}` as const]}: </span>{label(f)}</li>
                ))}
              </ul>
            )}
            <p className="text-sm text-muted">{t.pzFeedNever}</p>
            <p className="text-sm text-muted">{t.pzWhyHint}</p>
          </>
        )}
      </div>

      <div className="mt-4 border-t border-line/40 pt-3">
        <Button variant="danger" disabled={reset.isPending} onClick={() => setConfirm(true)}>{t.pzReset}</Button>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t.pzResetTitle} description={t.pzResetBody}
        actions={<><Button variant="ghost" onClick={() => setConfirm(false)}>{t.pzResetNo}</Button><Button variant="danger" loading={reset.isPending} onClick={() => reset.mutate()}>{t.pzResetYes}</Button></>} />
    </Card>
  );
}
