import Link from "next/link";
import AskInbox from "@/components/ask/AskInbox";
import { buttonClass } from "@/components/ui/Button";
import { dict, getLang } from "@/lib/i18n";
import { loginUrl } from "@/lib/guard";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Inbox() {
  const t = dict[await getLang()];
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  if (!signedIn) {
    return (
      <div className="space-y-3 text-center">
        <p>{t.askNeedsSignIn}</p>
        <Link href={loginUrl("/ask/inbox")} className={buttonClass()}>{t.signIn}</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.askInboxTitle}</h1>
      <p className="text-muted">{t.askInboxLead}</p>
      <AskInbox />
      <Link href="/ask" className={buttonClass({ variant: "secondary" })}>{t.askBackAsk}</Link>
    </div>
  );
}
