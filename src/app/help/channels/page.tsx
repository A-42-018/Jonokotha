import { notFound } from "next/navigation";
import Link from "next/link";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Card from "@/components/ui/Card";
import { waLink, platformNumbers, showNumber } from "@/lib/channels-api";
import { FLAGS } from "@/lib/flags-more";
import { dict, getLang } from "@/lib/i18n";
import { buttonClass } from "@/components/ui/Button";

/** WhatsApp and SMS entry points (F7.2, masterplan 7.15). Behind a flag until the provider accounts exist. Numbers come from the environment, never invented. */
export default async function Channels() {
  if (!FLAGS.channels) notFound();
  const t = dict[await getLang()];
  const n = platformNumbers();
  const wa = showNumber(n.whatsapp), sms = showNumber(n.sms);
  const link = waLink(n.whatsapp);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/spot-channels.svg" alt="" width={96} height={96} decoding="async" className="size-20 shrink-0 sm:size-24" />
        <h1 className="text-2xl font-semibold text-civic">{t.chnTitle}</h1>
      </div>
      <p className="text-muted">{t.chnLead}</p>
      {!wa && !sms && <PlannedPanel title={t.chnPlanned} body={t.chnPlannedBody} />}
      <Card as="section" title={t.chnSteps}>
        <ol className="list-decimal space-y-1 ps-6">
          <li>{t.chnStep1}</li><li>{t.chnStep2}</li><li>{t.chnStep3}</li><li>{t.chnStep4}</li>
        </ol>
      </Card>
      <Card as="section" title={t.chnNumbers}>
        <dl className="space-y-1">
          <div><dt className="inline text-muted">{t.chnWaNumber}: </dt><dd className="inline font-medium" dir="ltr">{wa || t.chnNoNumber}</dd></div>
          <div><dt className="inline text-muted">{t.chnSmsNumber}: </dt><dd className="inline font-medium" dir="ltr">{sms || t.chnNoNumber}</dd></div>
        </dl>
        <p className="mt-2 text-sm text-muted">{t.chnLongSms} {t.chnCostNote}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {link && <a href={link} target="_blank" rel="noopener noreferrer" className={buttonClass()}>{t.chnOpenWa}</a>}
          <Link href="/settings" className={buttonClass({ variant: "secondary" })}>{t.chnManage}</Link>
        </div>
      </Card>
      <p className="text-sm text-muted">{t.chnPrivacy}</p>
      <p className="rounded-xl bg-amber/10 p-3 text-sm">{t.chnEmergency}</p>
    </div>
  );
}
