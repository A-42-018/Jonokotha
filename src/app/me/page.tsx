import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import QueuedReports from "@/components/offline/QueuedReports";
import MyReports from "@/components/me/MyReports";
import Card from "@/components/ui/Card";
import State from "@/components/ui/State";
import { dict, getLang } from "@/lib/i18n";
import { listMyReports, parseFilter, parsePage, type MyReport } from "@/lib/my-reports";
import { currentUser } from "@/lib/supabase/server";

export default async function Me({ searchParams }: PageProps<"/me">) {
  const lang = await getLang();
  const t = dict[lang];
  const sp = await searchParams;
  let email: string | null = null;
  let isStaff = false;
  let role: string | null = null;
  let reports: MyReport[] = [];
  let failed = false;
  try {
    const cu = await currentUser();
    const { sb, user, isStaff: staff } = cu;
    email = user?.email ?? null;
    isStaff = staff;
    role = cu.role;
    if (user) {
      try { reports = await listMyReports(sb, user.id); } catch { failed = true; }
    }
  } catch { /* Supabase not configured: treat as signed out */ }

  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.meTitle}</h1>
      <Card title={t.account}>
        {email ? (
          <div className="space-y-2">
            <p className="text-muted">{t.meSignedInAs}</p>
            <p className="break-all font-medium">{email}</p>
            {isStaff && <Badge tone="teal">{t.staffRole}</Badge>}
            {isStaff && <div><Link href="/office" className={buttonClass({ variant: "secondary" })}>{t.officeCta}</Link></div>}
            {role === "admin" && <div><Link href="/admin" className={buttonClass({ variant: "secondary" })}>{t.adTitle}</Link></div>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted">{t.meSignedOut}</p>
            <Link href="/login" className={buttonClass()}>{t.signIn}</Link>
          </div>
        )}
      </Card>
      <QueuedReports />
      <Link href="/settings" className="inline-flex min-h-11 items-center text-civic underline">{t.stTitle}</Link>
      <Card title={t.meMyReports}>
        {!email ? (
          <State kind="expired" as="h2" title={t.stExpiredTitle} body={t.stExpiredBody} compact live="polite">
            <Link href="/login" className={buttonClass()}>{t.signIn}</Link>
          </State>
        ) : failed ? (
          <p role="alert" className="text-danger">{t.mrError}</p>
        ) : (
          <MyReports reports={reports} filter={parseFilter(sp.status)} page={parsePage(sp.page)} base="/me" t={t} lang={lang} />
        )}
      </Card>
      <Card title={t.meLanguage}>
        <a href="/lang" aria-label={t.navLangSwitch} className={buttonClass({ variant: "secondary" })}>{t.switchLang}</a>
      </Card>
    </div>
  );
}
