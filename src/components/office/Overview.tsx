import type { ReactNode } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { IdeasIcon, IssuesIcon, ProgressIcon, ResolvedIcon, AlertIcon } from "@/components/ui/TileIcons";
import { fmtNum, type Dict, type Lang } from "@/lib/i18n";
import type { Overview as O } from "@/lib/office";

/** Dashboard tiles. Real counts where the API has the data; tiles without data say so instead of inventing a number. */
export default function Overview({ o, t, lang }: { o: O; t: Dict; lang: Lang }) {
  const real: [string, number, ReactNode][] = [[t.odNew, o.newReports, <AlertIcon key="a" className="size-9" />], [t.odWaiting, o.waiting, <ProgressIcon key="b" className="size-9" />], [t.odForwarded, o.forwarded, <IdeasIcon key="c" className="size-9" />], [t.odResolvedMonth, o.resolvedThisMonth, <ResolvedIcon key="d" className="size-9" />], [t.odTotal, o.total, <IssuesIcon key="e" className="size-9" />]];
  const missing = [t.odUnassigned, t.odHighPriority, t.odOverdue, t.odSatisfaction];
  return (
    <section aria-labelledby="od-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="od-h" className="text-xl font-semibold">{t.odOverview}</h2>
        <Link href="/office/announcements" className={buttonClass({ variant: "secondary" })}>{t.odAnnouncements}</Link>
      </div>
      <p className="text-sm text-muted">{t.odOverviewNote}</p>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {real.map(([k, v, icon]) => (
          <Card key={k} padded={false} className="p-3">
            <dt className="flex items-center gap-2 text-sm text-muted">{icon}{k}</dt>
            <dd className="text-3xl font-semibold text-civic">{fmtNum(v, lang)}</dd>
          </Card>
        ))}
        {missing.map((k) => (
          <Card key={k} padded={false} className="border-dashed p-3">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="text-3xl font-semibold text-muted" aria-label={t.odNeedsBackend}>—<span className="block text-xs font-normal">{t.odNeedsBackend}</span></dd>
          </Card>
        ))}
      </dl>
    </section>
  );
}
