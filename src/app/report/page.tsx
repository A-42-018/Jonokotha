import Link from "next/link";
import { redirect } from "next/navigation";
import EmergencyNote from "@/components/EmergencyNote";
import ReportForm from "@/components/ReportForm";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { FLAGS } from "@/lib/flags-more";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export default async function Report() {
  const { user } = await currentUser();
  if (!user) redirect("/login");
  const lang = await getLang();
  return (
    <>
      <EmergencyNote t={dict[lang]} />
      {FLAGS.channels && <p className="mb-2 text-sm"><Link href="/help/channels" className="inline-flex min-h-11 items-center text-civic underline">{dict[lang].chnNavLink}</Link></p>}
      <ReportForm t={dict[lang]} lang={lang} constituencyId={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} />
    </>
  );
}
