import CasesPanel from "@/components/office/ws/CasesPanel";
import { officePage } from "@/lib/office-page";

export default function Page() {
  return officePage("/office/issues", (t) => t.owAllTitle, (t) => t.owAllLead, () => <CasesPanel mode="all" />);
}
