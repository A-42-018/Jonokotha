import StaffPanel from "@/components/office/ws/StaffPanel";
import { officePage } from "@/lib/office-page";

export default function Page() {
  return officePage("/office/staff", (t) => t.owStaffTitle, (t) => t.owStaffLead, (c, can) => <StaffPanel constituency={c} canInvite={can.assign} />);
}
