import { notFound } from "next/navigation";
import { PbList } from "@/components/r2/Pb";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Participatory budgeting (F8.6, Release 2). */
export default async function Budgeting() {
  if (!R2.budgeting) notFound();
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.r2PbTitle}</h1>
      <p className="text-muted">{t.r2PbLead}</p>
      <PbList constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} />
    </div>
  );
}
