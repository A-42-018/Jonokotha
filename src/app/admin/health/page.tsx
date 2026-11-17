import { HealthPanel } from "@/components/admin/console/AdminConsole";
import { adminPage, planned } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/health", (t) => t.acHealthTitle, (t) => t.acHealthLead, (t) => (
    <div className="grid gap-4 md:grid-cols-2">
      <HealthPanel />
      {planned("adminHealthDetail", t.acHealthRestT, t.acHealthRestB)}
    </div>
  ));
}
