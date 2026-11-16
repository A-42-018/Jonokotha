import LiaisonPanel from "@/components/office/ws/LiaisonPanel";
import { officePage } from "@/lib/office-page";

export default function Page() {
  return officePage("/office/agency", (t) => t.lsTitle, (t) => t.lsLead, () => <LiaisonPanel />);
}
