import NewIdeaForm from "@/components/ideas/NewIdeaForm";
import { SAMPLE_IDEAS } from "@/lib/sample";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewIdea() {
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return <NewIdeaForm existing={SAMPLE_IDEAS} signedIn={signedIn} />;
}
