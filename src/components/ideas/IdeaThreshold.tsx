"use client";
import Badge from "@/components/ui/Badge";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum, fmtDay } from "@/lib/format";
import { progress } from "@/lib/ideas-r11-api";
import type { IdeaThreshold as Threshold } from "@/lib/ideas";

/**
 * Progress toward the office's support threshold, then the answer state (F7.5, masterplan 7.7 and 8.11).
 * The server decides the state on every read, so an overdue idea cannot be hidden by the office. `supports` is the public count;
 * only supporters who follow the area count toward the threshold, and the note says so.
 */
export default function IdeaThreshold({ threshold: th, supports }: { threshold: Threshold; supports: number }) {
  const t = useT();
  const lang = useLang();
  const pc = th.reachedAt ? 100 : progress(supports, th.target);
  return (
    <section aria-label={t.ixThreshTitle} className="space-y-2 rounded-xl border border-line bg-slate-50 p-3">
      <h3 className="text-sm font-semibold">{t.ixThreshTitle}</h3>
      <p className="text-sm">{fillNum(t.ixThreshLead, { t: th.target, n: supports }, lang)}</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pc} aria-label={fillNum(t.ixThreshBar, { pc }, lang)} className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-civic" style={{ width: `${pc}%` }} />
      </div>
      <p className="text-xs text-muted">{t.ixThreshNote}</p>
      {th.reachedAt && <Answer th={th} />}
    </section>
  );
}

function Answer({ th }: { th: Threshold }) {
  const t = useT();
  const lang = useLang();
  const due = th.dueAt ? fmtDay(th.dueAt, lang) : null;
  const done = th.respondedAt ? fmtDay(th.respondedAt, lang) : null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      <Badge tone="info" icon="✓">{t.ixReached}</Badge>
      {th.state === "awaiting_response" && <><Badge tone="warning" icon="⏳">{t.ixAwaiting}</Badge>{due && <span className="text-sm">{fillNum(t.ixDue, { date: due }, lang)}</span>}</>}
      {th.state === "overdue" && <><Badge tone="danger" icon="!">{t.ixOverdue}</Badge>{due && <span className="text-sm">{fillNum(t.ixOverdueDue, { date: due }, lang)}</span>}</>}
      {(th.state === "answered" || th.state === "answered_late") && <><Badge tone={th.state === "answered" ? "success" : "warning"} icon="✓">{th.state === "answered" ? t.ixAnswered : t.ixAnsweredLate}</Badge>{done && <span className="text-sm">{fillNum(t.ixAnsweredOn, { date: done }, lang)}</span>}</>}
    </div>
  );
}
