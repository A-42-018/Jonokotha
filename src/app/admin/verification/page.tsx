import AdminShell from "@/components/admin/AdminShell";
import VerifyForm from "@/components/admin/VerifyForm";
import NoAccess from "@/components/ui/NoAccess";
import { guardAdmin } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

export default async function Verification() {
  const t = dict[await getLang()];
  const { denied } = await guardAdmin("/admin/verification");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/admin/verification" />;
  return <AdminShell t={t} title={t.adVerifyTitle} lead={t.adVerifyLead} current="/admin/verification"><VerifyForm /></AdminShell>;
}
