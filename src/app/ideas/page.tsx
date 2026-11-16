import IdeasView from "@/components/ideas/IdeasView";
import { SAMPLE_IDEAS } from "@/lib/sample";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Ideas list. No ideas API yet: sample ideas only, labelled. Support is a device-local stub. */
export default async function Ideas() {
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* treat as signed out */ }
  return <IdeasView ideas={SAMPLE_IDEAS} signedIn={signedIn} />;
}
