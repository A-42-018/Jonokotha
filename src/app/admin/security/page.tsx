import { PageLink } from "@/components/admin/console/AdminConsole";
import { adminPage, planned } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/security", (t) => t.acSecTitle, (t) => t.acSecLead, (t) => planned("adminAlerts", t.acSecAlertsT, t.acSecAlertsB, <PageLink href="/admin/audit">{t.acAuditLink}</PageLink>));
}
