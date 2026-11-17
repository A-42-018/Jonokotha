import CasesPanel from "@/components/office/ws/CasesPanel";
import { officePage } from "@/lib/office-page";

export default function Page() {
  return officePage("/office/mine", (t) => t.owMineTitle, (t) => t.owMineLead, () => <CasesPanel mode="mine" />);
}
