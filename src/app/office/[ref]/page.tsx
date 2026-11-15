import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ApproveButtons from "@/components/ApproveButtons";
import AiPanel from "@/components/office/AiPanel";
import StatusChip from "@/components/office/StatusChip";
import NoAccess from "@/components/ui/NoAccess";
import { AGENCIES } from "@/lib/demo-data";
import { dict, fmtDate, getLang } from "@/lib/i18n";
import { getCase } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";

export default async function Case({ params }: PageProps<"/office/[ref]">) {
  const { ref } = await params;
  const { sb, user, isStaff } = await currentUser();
  if (!user) redirect("/login?expired=1");
  const lang = await getLang();
  const t = dict[lang];
  if (!isStaff) return <NoAccess t={t} />;
  const c = await getCase(sb, ref);
  if (!c) notFound();
  const agency = AGENCIES.find((a) => a.id === c.ai.agencyId);
  return (
    <div className="space-y-4">
      <Link href="/office" className="inline-flex min-h-11 items-center text-civic underline focus-visible:outline-2 focus-visible:outline-civic">← {t.back}</Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-civic">{c.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span>{c.ref}</span>
          <StatusChip status={c.status} label={t.statuses[c.status]} />
          <span className="text-teal">{t.cats[c.category]}</span>
          <span>{c.area || t.ofNoArea}</span>
          <span>{fmtDate(c.createdAt, lang)}</span>
        </div>
      </header>
      <section aria-labelledby="rep-title" className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="rep-title" className="font-semibold text-slate-700">{t.ofReport}</h2>
        <p className="whitespace-pre-wrap break-words">{c.description}</p>
      </section>
      <AiPanel c={c} agency={agency} t={t} lang={lang}>
        <ApproveButtons cref={c.ref} status={c.status} />
      </AiPanel>
    </div>
  );
}
