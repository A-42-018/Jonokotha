import Link from "next/link";
import Card from "@/components/ui/Card";
import { dict, getLang } from "@/lib/i18n";

/** Accessibility statement: what is done and what is still open, in plain words (masterplan 21.6). F5.17 extends the About and Terms pages. */
export default async function Accessibility() {
  const t = dict[await getLang()];
  const list = (items: string[]) => <ul className="list-disc space-y-1 ps-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.a11yTitle}</h1>
      <p className="text-muted">{t.a11yLead}</p>
      <Card title={t.a11yDoneTitle}>{list([t.a11yDone1, t.a11yDone2, t.a11yDone3, t.a11yDone4])}</Card>
      <Card title={t.a11yOpenTitle}>{list([t.a11yOpen1, t.a11yOpen2])}</Card>
      <Card title={t.a11yTellTitle}>
        <p>{t.a11yTell}</p>
        <Link href="/help" className="inline-flex min-h-11 items-center text-civic underline">{t.a11yHelp}</Link>
      </Card>
    </div>
  );
}
