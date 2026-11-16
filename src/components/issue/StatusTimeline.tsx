import type { Dict, Lang } from "@/lib/i18n";
import { fmtDate } from "@/lib/i18n";
import type { Status } from "@/lib/types";
import StatusChip from "@/components/ui/StatusChip";

export type TimelineStep = { status: Status; at: string };

/** One entry per timeline step, oldest first. Internal notes are never shown. */
export default function StatusTimeline({ steps, t, lang }: { steps: TimelineStep[]; t: Dict; lang: Lang }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span aria-hidden className="absolute inset-y-3 start-[0.4375rem] w-0.5 bg-line" />}
            <span aria-hidden className={`relative z-10 mt-1.5 size-4 shrink-0 rounded-full border-2 ${last ? "border-leaf-strong bg-leaf-strong" : "border-teal-strong bg-white"}`} />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={s.status} label={t.statuses[s.status]} />
                {last && steps.length > 1 && <span className="text-xs font-medium text-teal-strong">{t.isTimelineNow}</span>}
              </div>
              <time dateTime={s.at} className="block text-sm text-muted">{fmtDate(s.at, lang)}</time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
