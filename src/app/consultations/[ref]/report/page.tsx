import { notFound } from "next/navigation";
import ConsultationReport from "@/components/consult/ConsultationReport";
import { FLAGS } from "@/lib/flags";
import { dict, getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** "আপনারা বললেন, যা করা হলো": the published report of one consultation. */
export default async function Report({ params }: PageProps<"/consultations/[ref]/report">) {
  if (!FLAGS.consultations) notFound();
  const { ref } = await params;
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/spot-you-said.svg" alt="" width={96} height={96} decoding="async" className="size-20 shrink-0 sm:size-24" />
        <h1 className="jk-h1">{t.rpTitle}</h1>
      </div>
      <ConsultationReport refId={ref} />
    </div>
  );
}
