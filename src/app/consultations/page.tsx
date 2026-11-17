import { notFound } from "next/navigation";
import ConsultationsList from "@/components/consult/ConsultationsList";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { FLAGS } from "@/lib/flags";
import { dict, getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Release 1.1 (masterplan 7.14). With the flag off (the default) the page does not exist, so nothing links to a dead end. */
export default async function Consultations() {
  if (!FLAGS.consultations) notFound();
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/spot-consult.svg" alt="" width={96} height={96} decoding="async" className="size-20 shrink-0 sm:size-24" />
        <h1 className="text-2xl font-semibold text-civic">{t.coTitle}</h1>
      </div>
      <p className="text-muted">{t.csLead}</p>
      <p className="text-sm text-muted">{t.csScope}</p>
      <ConsultationsList constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} />
    </div>
  );
}
