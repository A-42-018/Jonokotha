import Link from "next/link";
import { notFound } from "next/navigation";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import RepCard from "@/components/mp/RepCard";
import { dict, fillNum, fmtDay, fmtNum, getLang } from "@/lib/i18n";
import { answeredShare, repById } from "@/lib/mp";

/** Representative profile (§7.9): verified record, office contact, announcements, responsiveness with its period. Never ranks. */
export default async function RepProfile({ params }: PageProps<"/mp/[id]">) {
  const { id } = await params;
  const rep = repById(id);
  if (!rep) notFound();
  const lang = await getLang();
  const t = dict[lang];
  const b = lang === "bn";
  const s = rep.stats;
  const rows: [string, string][] = [
    [t.mpReceived, fmtNum(s.received, lang)],
    [t.mpAnswered, `${fmtNum(s.answered, lang)} (${fmtNum(answeredShare(s), lang)}%)`],
    [t.mpPending, fmtNum(s.pending, lang)],
    [t.mpMedian, fillNum(t.mpDays, { n: s.medianFirstResponseDays }, lang)],
  ];

  return (
    <div className="space-y-5">
      <h1 className="sr-only">{b ? rep.nameBn : rep.nameEn}</h1>
      <RepCard rep={rep} t={t} lang={lang} showProfile={false} />
      <p className="text-sm text-muted">{t.mpTerm}: {fmtDay(rep.termFrom, lang)} – {fmtDay(rep.termTo, lang)}</p>

      <Card title={t.mpOfficeTitle}>
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-medium">{t.mpAddress}</dt><dd>{b ? rep.office.addressBn : rep.office.addressEn}</dd>
          <dt className="font-medium">{t.mpPhone}</dt><dd>{rep.office.phone}</dd>
          <dt className="font-medium">{t.mpEmail}</dt><dd className="break-all">{rep.office.email}</dd>
          <dt className="font-medium">{t.mpHours}</dt><dd>{b ? rep.office.hoursBn : rep.office.hoursEn}</dd>
        </dl>
      </Card>

      <Card title={t.mpAnnouncements}>
        <p className="mb-2 text-sm text-muted">{t.mpAnnouncementNote}</p>
        {rep.announcements.length === 0 ? <p>{t.mpNoAnnouncements}</p> : (
          <ul className="space-y-2">
            {rep.announcements.map((a) => (
              <li key={a.id}><p className="font-medium">{b ? a.titleBn : a.titleEn}</p><p className="text-sm text-muted">{fmtDay(a.date, lang)}</p></li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t.mpResponseTitle}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="warning">{t.mpStatsSample}</Badge>
          <span className="text-sm text-muted">{fillNum(t.mpResponsePeriod, { from: fmtDay(s.from, lang), to: fmtDay(s.to, lang) }, lang)}</span>
        </div>
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto]">
          {rows.map(([k, v]) => (<div key={k} className="contents"><dt>{k}</dt><dd className="font-semibold">{v}</dd></div>))}
        </dl>
        <p className="mt-3 text-sm text-muted">{t.mpNoRank}</p>
        <Link href="/mp/method" className="mt-2 inline-flex min-h-11 items-center text-civic underline">{t.mpHow}</Link>
      </Card>
      <Link href="/mp" className={buttonClass({ variant: "ghost" })}>{t.mpBackFind}</Link>
    </div>
  );
}
