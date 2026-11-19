import IdeasView from "@/components/ideas/IdeasView";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { currentUser } from "@/lib/supabase/server";
import { demoOn } from "@/lib/demo-mode-server";

export const dynamic = "force-dynamic";

/** Ideas list from GET /api/v1/ideas for the chosen area. Support goes to the server. */
export default async function Ideas() {
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user || (await demoOn()); } catch { /* treat as signed out */ }
  return <IdeasView constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} signedIn={signedIn} />;
}
