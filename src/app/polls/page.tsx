import Link from "next/link";
import PollsPanel from "@/components/citizen/PollsPanel";
import { buttonClass } from "@/components/ui/Button";
import { loginUrl } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Polls and surveys (masterplan 6.2, F5.11). The list and the vote come from /api/v1/polls; if the server has none yet the panel says so. */
export default async function Polls() {
  const t = dict[await getLang()];
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.plTitle}</h1>
      <p className="text-muted">{t.pvLead}</p>
      <PollsPanel signedIn={signedIn} loginHref={loginUrl("/polls")} />
      <Link href="/" className={buttonClass({ variant: "secondary" })}>{t.plBack}</Link>
    </div>
  );
}
