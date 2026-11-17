"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDay, fmtNum } from "@/lib/format";
import { answeredPercent, fetchRep, fetchResponsiveness, medianLabel, repView, sourceHost, type RepField } from "@/lib/mp-api";
import QueryProvider from "../QueryProvider";
import RepCard from "./RepCard";

export default function RepProfile({ id }: { id: string }) {
  return <QueryProvider><ProfileInner id={id} /></QueryProvider>;
}

/** Representative profile (§7.9): verified record with each field's source and date, announcements, responsiveness with its period. Never ranks. */
function ProfileInner({ id }: { id: string }) {
  const t = useT();
  const lang = useLang();
  const rep = useQuery({ queryKey: ["rep", id], queryFn: () => fetchRep(id) });
  const area = rep.data?.constituencies.find((c) => !c.valid_to) ?? rep.data?.constituencies[0];
  const stats = useQuery({ queryKey: ["responsiveness", area?.key], queryFn: () => fetchResponsiveness(area!.key), enabled: !!area });

  if (rep.isPending) return <p role="status" className="text-muted">{t.exLoading}</p>;
  if (rep.isError) {
    const missing = rep.error instanceof ApiError && rep.error.status === 404;
    return (
      <div className="space-y-3">
        <EmptyState variant="noResults" title={missing ? t.mpNotFoundTitle : t.mpLoadError} body={missing ? t.mpNotFoundBody : ""} />
        {!missing && <Button variant="secondary" onClick={() => void rep.refetch()}>{t.exRetry}</Button>}
        <Link href="/mp" className={buttonClass({ variant: "ghost" })}>{t.mpBackFind}</Link>
      </div>
    );
  }

  const r = rep.data;
  const field = (name: string): RepField | undefined => r.fields?.find((f) => f.field === name);
  const contact: [string, RepField | undefined][] = [[t.mpAddress, field("office_address")], [t.mpPhone, field("office_phone")], [t.mpEmail, field("office_email")]];
  const shown = contact.filter(([, f]) => f);
  const s = stats.data;
  const med = s ? medianLabel(s.median_hours_to_first_response) : null;
  const rows: [string, string][] = s ? [
    [t.mpReceived, fmtNum(s.received, lang)],
    [t.mpAnswered, `${fmtNum(s.answered, lang)} (${fmtNum(answeredPercent(s), lang)}%)`],
    [t.mpPending, fmtNum(s.pending, lang)],
    [t.mpMedian, med ? fillNum(med.unit === "days" ? t.mpDays : t.mpHoursN, { n: med.n }, lang) : "—"],
  ] : [];

  return (
    <div className="space-y-5">
      <h1 className="sr-only">{lang === "bn" ? r.full_name_bn || r.full_name : r.full_name}</h1>
      <RepCard rep={repView(r, area, lang, t.mpRoleFallback)} t={t} lang={lang} showProfile={false} />
      {area && <p className="text-sm text-muted">{t.mpTerm}: {fmtDay(area.valid_from, lang)}{area.valid_to ? ` – ${fmtDay(area.valid_to, lang)}` : ""}</p>}

      <Card title={t.mpOfficeTitle}>
        {shown.length === 0 ? <p>{t.mpNoContact}</p> : (
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
            {shown.map(([label, f]) => (
              <div key={label} className="contents">
                <dt className="font-medium">{label}</dt>
                <dd className="break-words">{f!.value}<span className="block text-xs text-muted">{fillNum(t.mpFieldChecked, { date: fmtDay(f!.checked_at, lang), host: sourceHost(f!.source_url) ?? "" }, lang)}</span></dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card title={t.mpAnnouncements}>
        <p className="mb-2 text-sm text-muted">{t.mpAnnouncementNote}</p>
        {r.announcements.length === 0 ? <p>{t.mpNoAnnouncements}</p> : (
          <ul className="space-y-2">
            {r.announcements.map((a) => (
              <li key={a.ref}><p className="font-medium">{a.title}</p><p className="text-sm text-muted">{fmtDay(a.published_at, lang)}</p></li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t.mpResponseTitle}>
        {stats.isPending && <p role="status" className="text-sm text-muted">{t.exLoading}</p>}
        {stats.isError && <p role="alert" className="text-sm">{t.mpLoadError}</p>}
        {s && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {s.is_sample && <Badge tone="warning">{t.mpStatsSample}</Badge>}
              <span className="text-sm text-muted">{fillNum(t.mpResponsePeriod, { from: fmtDay(s.from, lang), to: fmtDay(s.to, lang) }, lang)}</span>
            </div>
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto]">
              {rows.map(([k, v]) => (<div key={k} className="contents"><dt>{k}</dt><dd className="font-semibold">{v}</dd></div>))}
            </dl>
            <p className="mt-2 text-xs text-muted">{fillNum(t.mpStatsFetched, { date: fmtDay(new Date(stats.dataUpdatedAt).toISOString(), lang) }, lang)}</p>
          </>
        )}
        <p className="mt-3 text-sm text-muted">{t.mpNoRank}</p>
        <Link href="/mp/method" className="mt-2 inline-flex min-h-11 items-center text-civic underline">{t.mpHow}</Link>
        <p className="text-sm"><Link href="/metrics#median" className="inline-flex min-h-11 items-center text-civic underline">{t.mxHow}</Link></p>
      </Card>
      <Link href="/mp" className={buttonClass({ variant: "ghost" })}>{t.mpBackFind}</Link>
    </div>
  );
}
