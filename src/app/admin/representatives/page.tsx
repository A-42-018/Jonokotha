import { PageLink, RepFieldsPanel } from "@/components/admin/console/AdminConsole";
import { adminPage } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/representatives", (t) => t.acRepsTitle, (t) => t.acRepsLead, (t) => (
    <div className="space-y-4">
      <RepFieldsPanel />
      <PageLink href="/admin/verification">{t.acRepsVerifyLink}</PageLink>
    </div>
  ));
}
