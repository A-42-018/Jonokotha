import Link from "next/link";
import { notFound } from "next/navigation";
import Copilot from "@/components/office/Copilot";
import NotesAndAssign from "@/components/office/NotesAndAssign";
import AuditList from "@/components/office/AuditList";
import OfficeActions from "@/components/office/OfficeActions";
import StatusChip from "@/components/ui/StatusChip";
import NoAccess from "@/components/ui/NoAccess";
import { AGENCIES } from "@/lib/demo-data";
import { dict, fmtDate, getLang } from "@/lib/i18n";
import { auditFromTimeline } from "@/lib/office-actions";
import { getCase } from "@/lib/store";
import { guardStaff } from "@/lib/guard";

export default async function Case({ params }: PageProps<"/office/[ref]">) {
  const { ref } = await params;
  const { sb, denied } = await guardStaff(`/office/${ref}`);
  const lang = await getLang();
  const t = dict[lang];
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next={`/office/${ref}`} />;
  const c = await getCase(sb, ref);
  if (!c) notFound();
  const agency = AGENCIES.find((a) => a.id === c.ai.agencyId);
  return (
    <div className="space-y-4">
      <Link href="/office" className="inline-flex min-h-11 items-center text-civic underline focus-visible:outline-2 focus-visible:outline-civic">← {t.back}</Link>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
      <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-civic">{c.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span>{c.ref}</span>
          <StatusChip status={c.status} label={t.statuses[c.status]} />
          <span className="text-teal-strong">{t.cats[c.category]}</span>
          <span className="min-w-0 max-w-full break-words">{c.area || t.ofNoArea}</span>
          <span>{fmtDate(c.createdAt, lang)}</span>
        </div>
      </header>
      <section aria-labelledby="rep-title" className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="rep-title" className="font-semibold text-slate-700">{t.ofReport}</h2>
        <p className="whitespace-pre-wrap break-words">{c.description}</p>
      </section>
      <AuditList entries={auditFromTimeline(c.timeline)} t={t} lang={lang} />
      <NotesAndAssign cref={c.ref} />
      </div>
      <div className="lg:sticky lg:top-4">
      <div className="space-y-4">
        <Copilot c={c} agency={agency} />
        <section aria-labelledby="act-h" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 id="act-h" className="font-medium">{t.ofActions}</h2>
          <p className="text-xs text-amber-800">{t.humanOnly}</p>
          {/* Only acknowledge and refer exist in the backend today; request_info and resolve need it (see task notes). */}
          <OfficeActions cref={c.ref} status={c.status} enabled={["acknowledge", "refer"]} />
        </section>
      </div>
      </div>
      </div>
    </div>
  );
}
