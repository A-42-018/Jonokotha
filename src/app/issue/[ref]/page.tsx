import { notFound } from "next/navigation";
import { dict, fmtDate, getLang } from "@/lib/i18n";
import { getCase } from "@/lib/store";


export default async function Issue({ params }: PageProps<"/issue/[ref]">) {
  const { ref } = await params;
  const c = getCase(ref);
  if (!c) notFound();
  const lang = await getLang();
  const t = dict[lang];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t.refId}: <b>{c.ref}</b></p>
      <h1 className="text-2xl font-semibold text-civic">{c.title}</h1>
      <p>{c.description}</p>
      <p className="text-sm">{t.fCategory}: {t.cats[c.category]}{c.area && ` · ${c.area}`}</p>
      <h2 className="pt-2 text-lg font-semibold">{t.timeline}</h2>
      <ol className="space-y-2 border-l-2 border-teal pl-4">
        {c.timeline.map((e, i) => (
          <li key={i}><b>{t.statuses[e.status]}</b> <span className="text-xs text-slate-500">{fmtDate(e.at, lang)}</span></li>
        ))}
      </ol>
    </div>
  );
}
