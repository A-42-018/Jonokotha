import { notFound } from "next/navigation";
import Rti from "@/components/r2/Rti";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Right to Information helper (F8.7, Release 2). Drafts only; nothing is filed or sent. */
export default async function RtiPage() {
  if (!R2.rti) notFound();
  const t = dict[await getLang()];
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.r2RtTitle}</h1>
      <p className="text-muted">{t.r2RtLead}</p>
      <Rti signedIn={signedIn} />
    </div>
  );
}
