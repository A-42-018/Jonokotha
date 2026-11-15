import { redirect } from "next/navigation";
import CaseQueue from "@/components/office/CaseQueue";
import NoAccess from "@/components/ui/NoAccess";
import State from "@/components/ui/State";
import { dict, getLang } from "@/lib/i18n";
import { listCases } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";

export default async function Office() {
  const lang = await getLang();
  const t = dict[lang];
  const { sb, user, isStaff } = await currentUser();
  if (!user) redirect("/login?expired=1");
  if (!isStaff) return <NoAccess t={t} />;
  const cases = await listCases(sb);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.queue}</h1>
      {cases.length === 0 ? <State kind="officeEmpty" title={t.emptyQueue} as="h2" /> : <CaseQueue cases={cases} t={t} lang={lang} />}
    </div>
  );
}
