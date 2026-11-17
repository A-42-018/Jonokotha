import { notFound } from "next/navigation";
import { MpRecords } from "@/components/r2/MpRecords";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** MP activity from official records (F8.8, Release 2). `?mp=` narrows to one member; there is no sorting. */
export default async function MpRecordsPage({ searchParams }: PageProps<"/mp-records">) {
  if (!R2.mpRecords) notFound();
  const t = dict[await getLang()];
  const sp = await searchParams;
  const mp = typeof sp.mp === "string" && /^[0-9a-f-]{36}$/i.test(sp.mp) ? sp.mp : undefined;
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.r2MrTitle}</h1>
      <p className="text-muted">{t.r2MrLead}</p>
      <MpRecords representativeId={mp} />
    </div>
  );
}
