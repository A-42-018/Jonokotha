import Link from "next/link";
import Card from "@/components/ui/Card";
import LegalMeta from "@/components/LegalMeta";
import { dict, getLang } from "@/lib/i18n";

export default async function Privacy() {
  const lang = await getLang();
  const t = dict[lang];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.pnTitle}</h1>
      <LegalMeta t={t} lang={lang} />
      <Card tone="info" title={t.pnSummaryTitle}>
        <ul className="list-disc space-y-1 ps-5">{[t.pnS1, t.pnS2, t.pnS3, t.pnS4, t.pnS5, t.pnS6].map((x) => <li key={x}>{x}</li>)}</ul>
      </Card>
      <h2 className="text-xl font-semibold">{t.pnDetailTitle}</h2>
      <Card title={t.pnCollectTitle} headingAs="h3"><p>{t.pnCollect}</p></Card>
      <Card title={t.pnWhoTitle} headingAs="h3"><p>{t.pnWho}</p></Card>
      <Card title={t.pnKeepTitle} headingAs="h3"><p>{t.pnKeep}</p></Card>
      <Card title={t.pnRightsTitle} headingAs="h3"><p>{t.pnRights}</p><Link href="/settings" className="inline-flex min-h-11 items-center text-civic underline">{t.stTitle}</Link></Card>
      <Card title={t.pnChildrenTitle} headingAs="h3"><p>{t.pnChildren}</p></Card>
      <Card title={t.pnChangeTitle} headingAs="h3"><p>{t.pnChange}</p></Card>
    </div>
  );
}
