import Link from "next/link";
import Card from "@/components/ui/Card";
import { DADU } from "@/lib/flags-dadu";
import { dict, getLang } from "@/lib/i18n";

export default async function Help() {
  const t = dict[await getLang()];
  const list = (items: string[], ordered = false) => {
    const L = ordered ? "ol" : "ul";
    return <L className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 ps-5`}>{items.map((x) => <li key={x}>{x}</li>)}</L>;
  };
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.hpTitle}</h1>
      <Card id="emergency" tone="danger" title={t.hpEmergencyTitle}><p className="font-medium">{t.hpEmergencyBody}</p></Card>
      {DADU.on && (
        <Card tone="info">
          <div className="flex items-center gap-4">
            <img src="/illustrations/dadu.svg" alt="" width={72} height={90} loading="lazy" decoding="async" className="h-[90px] w-[72px] shrink-0" />
            <div><h2 className="text-lg font-semibold text-civic">{t.ddHeroTitle}</h2><p className="text-muted">{t.ddHeroBody}</p></div>
          </div>
        </Card>
      )}
      <Card title={t.hpHowTitle}>{list([t.hpHow1, t.hpHow2, t.hpHow3], true)}</Card>
      <Card title={t.hpSafetyTitle}>{list([t.hpSafety1, t.hpSafety2, t.hpSafety3])}</Card>
      <Card title={t.hpOfficialTitle}><p>{t.hpOfficialBody}</p></Card>
      <Card title={t.hpReportTitle}><p>{t.hpReportBody}</p></Card>
      <div className="flex flex-wrap gap-x-4">
        <Link href="/help/contact" className="inline-flex min-h-11 items-center text-civic underline">{t.spHelpLink}</Link>
        <Link href="/privacy" className="inline-flex min-h-11 items-center text-civic underline">{t.hpPrivacyLink}</Link>
      </div>
    </div>
  );
}
