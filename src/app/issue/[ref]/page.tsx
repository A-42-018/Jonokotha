import { notFound } from "next/navigation";
import IssueView from "@/components/issue/IssueView";
import { dict, getLang } from "@/lib/i18n";
import { getCase } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Issue({ params }: PageProps<"/issue/[ref]">) {
  const { ref } = await params;
  const c = await getCase(await supabaseServer(), ref);
  if (!c) notFound();
  const lang = await getLang();
  return <IssueView c={c} t={dict[lang]} lang={lang} />;
}
