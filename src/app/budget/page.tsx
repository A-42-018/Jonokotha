import { notFound } from "next/navigation";
import BudgetPublic from "@/components/r2/BudgetPublic";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Budget and expenditure (F8.1, Release 2). With the flag off the page does not exist. */
export default async function Budget({ searchParams }: PageProps<"/budget">) {
  if (!R2.budget) notFound();
  const t = dict[await getLang()];
  const sp = await searchParams;
  const project = typeof sp.project === "string" ? sp.project : undefined;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.r2BgTitle}</h1>
      <p className="text-muted">{t.r2BgLead}</p>
      <BudgetPublic constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} project={project} />
    </div>
  );
}
