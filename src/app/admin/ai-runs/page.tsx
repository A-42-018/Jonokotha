import AdminShell from "@/components/admin/AdminShell";
import AiRunsTable from "@/components/admin/AiRunsTable";
import NoAccess from "@/components/ui/NoAccess";
import { guardAdmin } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

export default async function AiRuns() {
  const t = dict[await getLang()];
  const { denied } = await guardAdmin("/admin/ai-runs");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/admin/ai-runs" />;
  return <AdminShell t={t} title={t.adAiTitle} lead={t.adAiLead} current="/admin/ai-runs"><AiRunsTable /></AdminShell>;
}
