import ChallengeForm from "@/components/ChallengeForm";
import LegalMeta from "@/components/LegalMeta";
import { dict, getLang } from "@/lib/i18n";
import { SUPPORT_EMAIL } from "@/lib/legal";

export default async function Challenge({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const lang = await getLang();
  const t = dict[lang];
  const ref = ((await searchParams).ref ?? "").slice(0, 41);
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.chTitle}</h1>
      <ChallengeForm supportEmail={SUPPORT_EMAIL} defaultRef={ref} />
      <LegalMeta t={t} lang={lang} />
    </div>
  );
}
