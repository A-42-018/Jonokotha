import AdminShell from "@/components/admin/AdminShell";
import ModerationQueue from "@/components/admin/ModerationQueue";
import NoAccess from "@/components/ui/NoAccess";
import { guardAdmin } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

export default async function Moderation() {
  const t = dict[await getLang()];
  const { denied } = await guardAdmin("/admin/moderation");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/admin/moderation" />;
  return <AdminShell t={t} title={t.adModTitle} lead={t.adModLead} current="/admin/moderation"><ModerationQueue /></AdminShell>;
}
