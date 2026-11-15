import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export default async function Me() {
  const lang = await getLang();
  const t = dict[lang];
  let email: string | null = null;
  let isStaff = false;
  try {
    const { user, isStaff: staff } = await currentUser();
    email = user?.email ?? null;
    isStaff = staff;
  } catch { /* Supabase not configured: treat as signed out */ }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.meTitle}</h1>
      <Card title={t.account}>
        {email ? (
          <div className="space-y-2">
            <p className="text-muted">{t.meSignedInAs}</p>
            <p className="break-all font-medium">{email}</p>
            {isStaff && <Badge tone="teal">{t.staffRole}</Badge>}
            {isStaff && <div><Link href="/office" className={buttonClass({ variant: "secondary" })}>{t.officeCta}</Link></div>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted">{t.meSignedOut}</p>
            <Link href="/login" className={buttonClass()}>{t.signIn}</Link>
          </div>
        )}
      </Card>
      <Card title={<span className="inline-flex flex-wrap items-center gap-2">{t.meMyReports} <Badge>{t.comingSoon}</Badge></span>}>
        <p className="text-muted">{t.meMyReportsSoon}</p>
      </Card>
      <Card title={t.meLanguage}>
        <a href="/lang" aria-label={t.navLangSwitch} className={buttonClass({ variant: "secondary" })}>{t.switchLang}</a>
      </Card>
    </div>
  );
}
