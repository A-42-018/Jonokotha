import Link from "next/link";
import NotificationList from "@/components/citizen/NotificationList";
import { buttonClass } from "@/components/ui/Button";
import { loginUrl } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";
import { demoOn } from "@/lib/demo-mode-server";

export const dynamic = "force-dynamic";

export default async function Notifications() {
  const t = dict[await getLang()];
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user || (await demoOn()); } catch { /* signed out */ }
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.ntTitle}</h1>
      <p className="text-muted">{t.ntLead}</p>
      {signedIn ? <NotificationList /> : (
        <div className="space-y-3">
          <p>{t.ntNeedsSignIn}</p>
          <Link href={loginUrl("/notifications")} className={buttonClass()}>{t.signIn}</Link>
        </div>
      )}
    </div>
  );
}
