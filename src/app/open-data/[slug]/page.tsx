import { notFound } from "next/navigation";
import { OpenDataSet } from "@/components/r2/OpenData";
import { getConstituencyId } from "@/lib/constituency-server";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function OpenDataOne({ params }: PageProps<"/open-data/[slug]">) {
  if (!R2.openData) notFound();
  const { slug } = await params;
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.r2OdTitle}</h1>
      <OpenDataSet slug={slug} constituency={(await getConstituencyId()) ?? undefined} />
    </div>
  );
}
