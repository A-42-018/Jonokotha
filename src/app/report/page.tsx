import { redirect } from "next/navigation";
import ReportForm from "@/components/ReportForm";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export default async function Report() {
  const { user } = await currentUser();
  if (!user) redirect("/login");
  const lang = await getLang();
  return <ReportForm t={dict[lang]} lang={lang} />;
}
