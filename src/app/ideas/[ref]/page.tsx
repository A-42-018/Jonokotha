import IdeaDetail from "@/components/ideas/IdeaDetail";
import { currentUser } from "@/lib/supabase/server";
import { demoOn } from "@/lib/demo-mode-server";

export const dynamic = "force-dynamic";

export default async function IdeaPage(props: PageProps<"/ideas/[ref]">) {
  const { ref } = await props.params;
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user || (await demoOn()); } catch { /* signed out */ }
  return <IdeaDetail refId={ref} signedIn={signedIn} />;
}
