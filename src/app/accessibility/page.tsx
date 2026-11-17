import Link from "next/link";
import Card from "@/components/ui/Card";
import { fmtDay } from "@/lib/format";
import { dict, getLang } from "@/lib/i18n";
import { POLICY_DATE, SUPPORT_EMAIL } from "@/lib/legal";

/** Accessibility statement: the target, what is done and what is still open, in plain words (masterplan 21.6, F5.17). */
export default async function Accessibility() {
  const lang = await getLang();
  const t = dict[lang];
  const list = (items: string[]) => <ul className="list-disc space-y-1 ps-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.a11yTitle}</h1>
      <p className="text-muted">{t.a11yLead}</p>
      <Card title={t.a11yStandardTitle}><p>{t.a11yStandard}</p></Card>
      <Card title={t.a11yDoneTitle}>{list([t.a11yDone1, t.a11yDone2, t.a11yDone3, t.a11yDone4, t.a11yDone5, t.a11yDone6, t.a11yDone7, t.a11yDone8])}</Card>
      <Card title={t.a11yOpenTitle}>{list([t.a11yOpen1, t.a11yOpen2, t.a11yOpen3, t.a11yOpen4, t.a11yOpen5])}</Card>
      <Card title={t.a11yTellTitle}>
        <p>{t.a11yTell}</p>
        <p>{SUPPORT_EMAIL ? <>{t.a11yContactMail} <a className="text-civic underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></> : t.a11yContactNone}</p>
        <Link href="/help" className="inline-flex min-h-11 items-center text-civic underline">{t.a11yHelp}</Link>
      </Card>
      <p className="text-sm text-muted">{t.a11yUpdated} {fmtDay(`${POLICY_DATE}T12:00:00+06:00`, lang)}</p>
    </div>
  );
}
