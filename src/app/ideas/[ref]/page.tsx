import IdeaDetail from "@/components/ideas/IdeaDetail";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IdeaPage(props: PageProps<"/ideas/[ref]">) {
  const { ref } = await props.params;
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return <IdeaDetail refId={ref} signedIn={signedIn} />;
}
