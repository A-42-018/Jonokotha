import { notFound } from "next/navigation";
import IssueView from "@/components/issue/IssueView";
import { dict, getLang } from "@/lib/i18n";
import { getCase } from "@/lib/store";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export default async function Issue({ params }: PageProps<"/issue/[ref]">) {
  const { ref } = await params;
  const c = await getCase(await supabaseServer(), ref);
  if (!c) notFound();
  const lang = await getLang();
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return <IssueView c={c} t={dict[lang]} lang={lang} signedIn={signedIn} />;
}
