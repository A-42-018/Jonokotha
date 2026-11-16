import AdminShell from "@/components/admin/AdminShell";
import AuditTable from "@/components/admin/AuditTable";
import NoAccess from "@/components/ui/NoAccess";
import { guardAdmin } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

export default async function Audit() {
  const t = dict[await getLang()];
  const { denied } = await guardAdmin("/admin/audit");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/admin/audit" />;
  return <AdminShell t={t} title={t.adAuditPageTitle} lead={t.adAuditLead} current="/admin/audit"><AuditTable /></AdminShell>;
}
