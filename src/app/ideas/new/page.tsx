import NewIdeaForm from "@/components/ideas/NewIdeaForm";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewIdea() {
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return <NewIdeaForm constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} signedIn={signedIn} />;
}
