import Link from "next/link";
import { notFound } from "next/navigation";
import ApproveButtons from "@/components/ApproveButtons";
import { AGENCIES } from "@/lib/demo-data";
import { dict, getLang } from "@/lib/i18n";
import { getCase } from "@/lib/store";


export default async function Case({ params }: PageProps<"/office/[ref]">) {
  const { ref } = await params;
  const c = getCase(ref);
  if (!c) notFound();
  const lang = await getLang();
  const t = dict[lang];
  const agency = AGENCIES.find((a) => a.id === c.ai.agencyId)!;
  return (
    <div className="space-y-4">
      <Link href="/office" className="text-civic underline">← {t.back}</Link>
      <h1 className="text-2xl font-semibold text-civic">{c.title}</h1>
      <p className="text-sm text-slate-600">{c.ref} · {t.statuses[c.status]} · {t.cats[c.category]}</p>
      <p>{c.description}</p>
      <section className="space-y-3 rounded-xl border border-teal/40 bg-white p-4">
        <h2 className="font-semibold text-teal">✨ {t.aiSummary}</h2>
        <p>{c.ai.summary || <span className="text-sm text-slate-500">{t.noAiSummary}</span>}</p>
        <div>
          <h3 className="font-medium">{t.similar}</h3>
          <p className="text-sm">{c.ai.similarRefs.length ? c.ai.similarRefs.map((r) => <Link key={r} href={`/office/${r}`} className="mr-2 underline">{r}</Link>) : t.noSimilar}</p>
        </div>
        <div>
          <h3 className="font-medium">{t.routing}</h3>
          <p>{lang === "bn" ? agency.nameBn : agency.nameEn}</p>
          <p className="text-xs text-slate-500">{t.source}: {agency.url ? <a href={agency.url} className="underline" target="_blank" rel="noreferrer">{agency.source}</a> : agency.source} · {t.confidence}: {Math.round(c.ai.confidence * 100)}%</p>
        </div>
        <p className="text-xs text-amber-800">{t.humanOnly}</p>
        <ApproveButtons cref={c.ref} ack={t.approveAck} refer={t.approveRefer} />
      </section>
    </div>
  );
}
