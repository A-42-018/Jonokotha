import { EvalsPanel } from "@/components/admin/console/AdminConsole";
import { adminPage } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/ai-evals", (t) => t.acEvalTitle, (t) => t.acEvalLead, () => <EvalsPanel />);
}
