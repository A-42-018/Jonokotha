import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { cx, focusRing } from "@/components/ui/cx";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip from "@/components/ui/StatusChip";
import { fillNum, fmtDate, fmtNum, type Dict, type Lang } from "@/lib/i18n";
import { countByStatus, reportsHref, selectPage, STATUS_FILTERS, type MyReport, type StatusFilter } from "@/lib/my-reports";
import ReportsPager from "./ReportsPager";

/**
 * The citizen's own reports: status filter (URL-driven links), list, pagination, empty states.
 * Server component. Renders public fields only (no ai.*, no timeline notes).
 */
export default function MyReports({ reports, filter, page, base, extra, t, lang }: {
  reports: MyReport[];
  filter: StatusFilter;
  page: number;
  base: string;
  extra?: Record<string, string>;
  t: Dict;
  lang: Lang;
}) {
  if (reports.length === 0) {
    return (
      <EmptyState
        title={t.mrEmptyTitle}
        body={t.mrEmptyBody}
        action={<Link href="/report" className={buttonClass()}>{t.reportCta}</Link>}
      />
    );
  }

  const counts = countByStatus(reports);
  const { rows, total, page: current, totalPages } = selectPage(reports, filter, page);
  const label = (f: StatusFilter) => (f === "all" ? t.mrAll : t.statuses[f]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{fillNum(t.mrSummary, { n: counts.all }, lang)}</p>
      <nav aria-label={t.mrFilterAria}>
        <ul className="-mx-1 flex flex-wrap gap-2 px-1">
          {STATUS_FILTERS.map((f) => {
            const active = f === filter;
            return (
              <li key={f}>
                <Link
                  href={reportsHref(base, f, 1, extra)}
                  aria-current={active ? "true" : undefined}
                  aria-label={fillNum(t.mrFilterLabel, { label: label(f), n: counts[f] }, lang)}
                  className={cx(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                    active ? "border-civic bg-civic text-white" : "border-line bg-white text-civic hover:bg-civic/5",
                    focusRing,
                  )}
                >
                  <span>{label(f)}</span>{" "}
                  <span aria-hidden className={cx("rounded-full px-2 text-xs", active ? "bg-white/20" : "bg-slate-100 text-muted")}>{fmtNum(counts[f], lang)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {total === 0 ? (
        <EmptyState
          variant="noResults"
          title={t.mrNoResultsTitle}
          body={t.mrNoResultsBody}
          action={<Link href={reportsHref(base, "all", 1, extra)} className={buttonClass({ variant: "secondary" })}>{t.mrShowAll}</Link>}
        />
      ) : (
        <>
          <ul aria-label={t.mrListAria} className="space-y-3">
            {rows.map((r) => (
              <Card as="li" key={r.ref} padded={false}>
                <Link href={`/issue/${r.ref}`} className={cx("block min-h-11 space-y-2 rounded-2xl p-4 hover:bg-civic/5 sm:p-5", focusRing)}>
                  <span className="flex flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0 break-words text-base font-semibold text-civic">{r.title}</span>
                    <StatusChip status={r.status} label={t.statuses[r.status]} />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
                    <span>{t.refId}: <b className="text-foreground">{r.ref}</b></span>
                    <Badge tone="teal">{t.cats[r.category]}</Badge>
                    <span>{r.area || t.mrNoArea}</span>
                    <span>{t.mrReportedOn}: {fmtDate(r.createdAt, lang)}</span>
                  </span>
                </Link>
              </Card>
            ))}
          </ul>
          <ReportsPager page={current} totalPages={totalPages} base={base} filter={filter} extra={extra} lang={lang} />
        </>
      )}
    </div>
  );
}
