import ReportsPanel from "@/components/office/ws/ReportsPanel";
import { officePage } from "@/lib/office-page";

export default function Page() {
  return officePage("/office/analytics", (t) => t.owAnTitle, null, (c) => <ReportsPanel constituency={c} />);
}
