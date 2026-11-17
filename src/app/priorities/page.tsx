import { notFound } from "next/navigation";
import PrioritiesPanel from "@/components/tracker/PrioritiesPanel";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { FLAGS } from "@/lib/flags";
import { loginUrl } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Community priority ranking (F7.8, Release 1.1). Non-binding. With the flag off the page does not exist. */
export default async function Priorities() {
  if (!FLAGS.priorities) notFound();
  const t = dict[await getLang()];
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.prxHeading}</h1>
      <p className="text-muted">{t.prxLead}</p>
      <PrioritiesPanel constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} signedIn={signedIn} loginHref={loginUrl("/priorities")} />
    </div>
  );
}
