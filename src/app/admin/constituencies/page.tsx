import { BoundaryPanel } from "@/components/admin/console/AdminConsole";
import { adminPage, planned } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/constituencies", (t) => t.acAreasTitle, (t) => t.acAreasLead, (t) => (
    <div className="space-y-4">
      <BoundaryPanel />
      {planned("adminAreaRecords", t.acAreasDirTitle, t.acAreasDirBody)}
    </div>
  ));
}
