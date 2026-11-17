import { KnowledgePanel } from "@/components/admin/console/AdminConsole";
import { adminPage, planned } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/knowledge", (t) => t.acKnowTitle, (t) => t.acKnowLead, (t) => (
    <div className="grid gap-4 md:grid-cols-2">
      <KnowledgePanel />
      {planned("adminKnowledgeManage", t.acKnowManageT, t.acKnowManageB)}
    </div>
  ));
}
