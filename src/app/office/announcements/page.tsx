import Link from "next/link";
import AnnouncementComposer from "@/components/office/AnnouncementComposer";
import NoAccess from "@/components/ui/NoAccess";
import { guardStaff } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

export default async function Announcements() {
  const t = dict[await getLang()];
  const { denied } = await guardStaff("/office/announcements");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/office/announcements" />;
  return (
    <div className="space-y-4">
      <Link href="/office" className="inline-flex min-h-11 items-center text-civic underline">← {t.anBack}</Link>
      <h1 className="text-2xl font-semibold text-civic">{t.anTitle}</h1>
      <p className="text-muted">{t.anLead}</p>
      <AnnouncementComposer />
    </div>
  );
}
