"use client";
import { useMutation } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fetchClarity, isNotOn } from "@/lib/ai-helpers-api";
import { featureStatus } from "@/lib/capability";

/**
 * Idea Assistant (F5.14, §17.2): clarity suggestions for a draft idea. The citizen decides; nothing here edits the form
 * and posting never waits for it. Until B5.10 adds the route the panel is text only (`live` is for tests and for the day
 * the feature flag flips).
 */
export default function ClarityHelper({ title, text, live = featureStatus("ideaClarity") === "live" }: { title: string; text: string; live?: boolean }) {
  const t = useT();
  const ask = useMutation({ mutationFn: () => fetchClarity(title, text) });
  if (!live) return <PlannedPanel as="h2" title={t.clNotOnTitle} body={t.clNotOnBody} />;
  const tooShort = title.trim().length < 5 || text.trim().length < 10;
  const err = ask.error;
  return (
    <section aria-labelledby="cl-h" className="space-y-2 rounded-2xl border border-line bg-white p-3">
      <h2 id="cl-h" className="jk-h2">{t.clTitle}</h2>
      <p className="text-sm text-muted">{t.clLead}</p>
      <Button variant="secondary" loading={ask.isPending} disabled={tooShort} onClick={() => ask.mutate()}>{ask.isPending ? t.clWorking : t.clAsk}</Button>
      {tooShort && <p className="text-sm text-muted">{t.clNeedText}</p>}
      <div aria-live="polite">
        {ask.isSuccess && !ask.data.available && <p>{t.clUnavailable}</p>}
        {ask.isSuccess && ask.data.available && ask.data.suggestions.length === 0 && <p>{t.clNone}</p>}
        {ask.isSuccess && ask.data.available && ask.data.suggestions.length > 0 && (
          <div className="space-y-1">
            <h3 className="font-medium">{t.clResult}</h3>
            <ul className="list-disc space-y-1 pl-5">{ask.data.suggestions.map((s, i) => <li key={i}>{s.text}</li>)}</ul>
          </div>
        )}
        {ask.isError && <p role="alert">{isNotOn(err) ? t.clUnavailable : err instanceof ApiError && err.isNetwork ? t.clOffline : t.clFail}</p>}
      </div>
    </section>
  );
}
