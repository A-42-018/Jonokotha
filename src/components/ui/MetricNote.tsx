"use client";
import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { metricHref, type MetricId } from "@/lib/metrics";
import { useLang } from "./useLang";
import { useT } from "./useT";

/**
 * The three things every public number needs: its period, when it was last updated, and where its definition is.
 * `period` is text already formatted for the language (a date range, a filter name or "since the report was sent").
 */
export default function MetricNote({ id, period, updated, className }: { id: MetricId; period: string; updated?: string; className?: string }) {
  const t = useT();
  const lang = useLang();
  return (
    <p className={className ?? "text-xs text-muted"}>
      <span>{t.mxPeriod}: {period}</span>
      {updated && <span> · {t.mxUpdated}: {fmtDate(updated, lang)}</span>}
      {" · "}
      <Link href={metricHref(id)} className="inline-flex min-h-6 items-center text-civic underline">{t.mxHow}</Link>
    </p>
  );
}
