import Link from "next/link";
import { redirect } from "next/navigation";
import EmergencyNote from "@/components/EmergencyNote";
import ReportForm from "@/components/ReportForm";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { FLAGS } from "@/lib/flags-more";
import { CATEGORIES, type Category } from "@/lib/categories";
import { loginUrl } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

/** `?category=roads` (from the home problem-type tiles) preselects that type. Unknown values are ignored. */
export default async function Report({ searchParams }: PageProps<"/report">) {
  const raw = (await searchParams).category;
  const category = typeof raw === "string" && (CATEGORIES as readonly string[]).includes(raw) ? (raw as Category) : undefined;
  const { user } = await currentUser();
  // Keep the chosen type through sign-in: the login page returns to `next`.
  if (!user) redirect(category ? loginUrl(`/report?category=${category}`) : "/login");
  const lang = await getLang();
  return (
    <>
      <EmergencyNote t={dict[lang]} />
      {FLAGS.channels && <p className="mb-2 text-sm"><Link href="/help/channels" className="inline-flex min-h-11 items-center text-civic underline">{dict[lang].chnNavLink}</Link></p>}
      <ReportForm t={dict[lang]} lang={lang} constituencyId={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} initialCategory={category} />
    </>
  );
}
