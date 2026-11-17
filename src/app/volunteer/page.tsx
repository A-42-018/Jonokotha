import { notFound } from "next/navigation";
import { VolunteerHub } from "@/components/r2/Assisted";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Assisted reporting for volunteers and kiosks (F8.3, Release 2). */
export default async function Volunteer({ searchParams }: PageProps<"/volunteer">) {
  if (!R2.assisted) notFound();
  const t = dict[await getLang()];
  const sp = await searchParams;
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.r2AsTitle}</h1>
      <p className="text-muted">{t.r2AsLead}</p>
      {sp.idle === "1" && <p role="status" className="rounded-xl border border-amber/60 bg-amber/10 p-3">{t.r2AsKioskIdle}</p>}
      <VolunteerHub constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} signedIn={signedIn} />
    </div>
  );
}
