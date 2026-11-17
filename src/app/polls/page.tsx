import Link from "next/link";
import PollsPanel from "@/components/citizen/PollsPanel";
import SurveysPanel from "@/components/citizen/SurveysPanel";
import { buttonClass } from "@/components/ui/Button";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { FLAGS } from "@/lib/flags-more";
import { loginUrl } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Polls and surveys (masterplan 6.2, F5.11, F7.6). Polls come from /api/v1/polls; surveys (Release 1.1) show only when the flag is on. */
export default async function Polls() {
  const t = dict[await getLang()];
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  const constituency = (await getConstituencyId()) ?? DEMO_CONSTITUENCY.id;
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.plTitle}</h1>
      <p className="text-muted">{t.pvLead}</p>
      <section aria-labelledby="pl-h" className="space-y-3">
        <h2 id="pl-h" className="jk-h2">{t.svPollsTitle}</h2>
        <PollsPanel signedIn={signedIn} loginHref={loginUrl("/polls")} constituency={constituency} />
      </section>
      {FLAGS.surveys && <SurveysPanel signedIn={signedIn} loginHref={loginUrl("/polls")} constituency={constituency} />}
      <Link href="/" className={buttonClass({ variant: "secondary" })}>{t.plBack}</Link>
    </div>
  );
}
