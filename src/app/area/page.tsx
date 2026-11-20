import AreaAlerts from "@/components/channels/AreaAlerts";
import ExploreView from "@/components/explore/ExploreView";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { FLAGS } from "@/lib/flags-more";
import { currentUser } from "@/lib/supabase/server";
import { demoOn } from "@/lib/demo-mode-server";

export const dynamic = "force-dynamic";

/** Explore issues: public reports from GET /api/v1/issues (approximate map positions, "me too" counts). Area alerts (Release 1.1) show above when switched on. */
export default async function Area() {
  const constituency = (await getConstituencyId()) ?? DEMO_CONSTITUENCY.id;
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user || (await demoOn()); } catch { /* signed out */ }
  return (
    <div className="space-y-4">
      {FLAGS.channels && <AreaAlerts constituency={constituency} />}
      <ExploreView constituency={constituency} signedIn={signedIn} />
    </div>
  );
}
