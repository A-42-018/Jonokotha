"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { useFeature } from "@/components/ui/useFeature";
import { MUTABLE_R11, MUTABLE_TYPES, toggleMuted, type NoticeType } from "@/lib/notifications-api";
import { fetchPrefs, savePrefs, type Prefs } from "@/lib/push";

/** Settings: which kinds of notification to receive, saved on the account (`muted_types`). Switching one off is the unsubscribe. */
export default function NoticeTypePrefs({ signedIn }: { signedIn: boolean }) {
  return <QueryProvider><Inner signedIn={signedIn} /></QueryProvider>;
}

function Inner({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const r11 = useFeature("consultations");
  const prefs = useQuery({ queryKey: ["me-prefs-types"], queryFn: fetchPrefs, enabled: signedIn });
  const save = useMutation({
    mutationFn: (muted: string[]) => savePrefs({ muted_types: muted }),
    // Show the choice at once; roll back if the server refuses.
    onMutate: async (muted) => {
      await qc.cancelQueries({ queryKey: ["me-prefs-types"] });
      const before = qc.getQueryData<Prefs>(["me-prefs-types"]);
      if (before) qc.setQueryData<Prefs>(["me-prefs-types"], { ...before, muted_types: muted });
      return { before };
    },
    onError: (_e, _m, ctx) => { if (ctx?.before) qc.setQueryData(["me-prefs-types"], ctx.before); toast("error", t.ntpFail); },
    onSuccess: () => toast("success", t.ntpSaved),
  });

  if (!signedIn) {
    return <Card title={t.ntpTitle}><p className="mb-2 text-muted">{t.ntpSignIn}</p><Link href="/login" className="inline-flex min-h-11 items-center text-civic underline">{t.signIn}</Link></Card>;
  }
  if (prefs.isPending) return <Card title={t.ntpTitle}><p role="status" className="text-muted">{t.pushLoading}</p></Card>;
  if (prefs.isError) {
    return <Card title={t.ntpTitle}><div role="alert" className="space-y-2"><p>{t.pushLoadError}</p><Button variant="secondary" onClick={() => void prefs.refetch()}>{t.pushRetry}</Button></div></Card>;
  }
  const muted = prefs.data.muted_types;
  return (
    <Card title={t.ntpTitle}>
      <p className="mb-2 text-muted">{t.ntpLead}</p>
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="sr-only">{t.ntpTitle}</legend>
        {[...MUTABLE_TYPES, ...(r11 ? MUTABLE_R11 : [])].map((type: NoticeType) => (
          <Checkbox key={type} label={t[`ntp_${type}` as keyof typeof t] as string} checked={!muted.includes(type)} disabled={save.isPending}
            onChange={(e) => save.mutate(toggleMuted(muted, type, e.target.checked))} />
        ))}
      </fieldset>
      <p className="mt-2 text-sm text-muted">{t.ntpNote}</p>
    </Card>
  );
}
