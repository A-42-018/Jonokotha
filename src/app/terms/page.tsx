import Link from "next/link";
import Card from "@/components/ui/Card";
import LegalMeta from "@/components/LegalMeta";
import { dict, getLang } from "@/lib/i18n";

export default async function Terms() {
  const lang = await getLang();
  const t = dict[lang];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.tmTitle}</h1>
      <LegalMeta t={t} lang={lang} />
      <Card><ol className="list-decimal space-y-2 ps-5">{[t.tm1, t.tm2, t.tm3, t.tm4, t.tm5, t.tm6, t.tm7, t.tm8].map((x) => <li key={x}>{x}</li>)}</ol></Card>
      <Card id="takedown" title={t.tkTitle}>
        <ul className="list-disc space-y-2 ps-5">{[t.tk1, t.tk2, t.tk3].map((x) => <li key={x}>{x}</li>)}</ul>
        <Link href="/challenge" className="inline-flex min-h-11 items-center text-civic underline">{t.lgToChallenge}</Link>
      </Card>
    </div>
  );
}
