import { notFound } from "next/navigation";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";
import { VOLUNTEER_RULES } from "@/lib/release2";

/** The paper consent sheet (F8.3): print it, read it aloud, and keep the signed copy. Texts are drafts until counsel and a native reviewer sign them off. */
export default async function Consent() {
  if (!R2.assisted) notFound();
  const lang = await getLang();
  const t = dict[lang];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.r2AsConsentTitle}</h1>
      {!VOLUNTEER_RULES.reviewed && <p role="note" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.r2AsDraft}</p>}
      <p className="text-sm text-muted">{VOLUNTEER_RULES.consent_version}</p>
      <p className="whitespace-pre-line text-lg">{VOLUNTEER_RULES.consent[lang]}</p>
      <p>{t.r2AsMethod}: {t.r2AsMethod_signed_paper}</p>
      <div className="grid gap-8 pt-8 sm:grid-cols-2"><p className="border-t border-slate-900 pt-1">{t.r2AsConsentTitle}</p><p className="border-t border-slate-900 pt-1">{t.r2AsVolunteers}</p></div>
      <p className="text-sm">{t.r2AsEmergency}</p>
    </div>
  );
}
