import { notFound } from "next/navigation";
import { PbDetail } from "@/components/r2/Pb";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BudgetingOne({ params }: PageProps<"/budgeting/[ref]">) {
  if (!R2.budgeting) notFound();
  const { ref } = await params;
  const t = dict[await getLang()];
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.r2PbTitle}</h1>
      <PbDetail refId={ref} signedIn={signedIn} />
    </div>
  );
}
