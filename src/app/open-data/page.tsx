import { notFound } from "next/navigation";
import { OpenDataList } from "@/components/r2/OpenData";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Open-data portal (F8.4, Release 2). */
export default async function OpenData() {
  if (!R2.openData) notFound();
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.r2OdTitle}</h1>
      <p className="text-muted">{t.r2OdLead}</p>
      <OpenDataList />
    </div>
  );
}
