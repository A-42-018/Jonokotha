import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { dict, getLang } from "@/lib/i18n";
import { R2 } from "@/lib/flags-r2";
import { SUPPORT_EMAIL } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict[await getLang()].abTitle };
}

/** About page (F5.17, masterplan 6.2): what Jonokotha is and is not, how AI and data are handled, how to reach someone. No facts beyond what the app itself does. */
export default async function About() {
  const t = dict[await getLang()];
  const list = (items: string[]) => <ul className="list-disc space-y-1 ps-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>;
  const link = "inline-flex min-h-11 items-center text-civic underline";
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.abTitle}</h1>
      <p className="text-muted">{t.abLead}</p>
      <Card title={t.abDoTitle}>{list([t.abDo1, t.abDo2, t.abDo3, t.abDo4])}</Card>
      <Card tone="danger" title={t.abNotTitle}>{list([t.abNot1, t.abNot2, t.abNot3])}</Card>
      <Card title={t.abAiTitle}>{list([t.abAi1, t.abAi2, t.abAi3])}</Card>
      <Card title={t.abDataTitle}>{list([t.abData1, t.abData2, t.abData3])}</Card>
      <Card title={t.abContactTitle}>
        <p>{SUPPORT_EMAIL ? <>{t.abContactMail} <a className="text-civic underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></> : t.abContactNone}</p>
        <Link href="/help" className={link}>{t.a11yHelp}</Link>
        {Object.values(R2).some(Boolean) && <Link href="/transparency" className={link}>{t.r2Hub}</Link>}
      </Card>
      <nav aria-label={t.abLinks} className="flex flex-wrap gap-x-4">
        <Link href="/terms" className={link}>{t.navTerms}</Link>
        <Link href="/privacy" className={link}>{t.footPrivacy}</Link>
        <Link href="/accessibility" className={link}>{t.hvFootA11y}</Link>
      </nav>
    </div>
  );
}
