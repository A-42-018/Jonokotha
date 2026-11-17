import OfficeR11 from "@/components/office/ws/OfficeR11";
import ReportsPanel from "@/components/office/ws/ReportsPanel";
import { FLAGS } from "@/lib/flags-more";
import { officePage } from "@/lib/office-page";

export default function Page() {
  return officePage("/office/analytics", (t) => t.owAnTitle, null, (c) => (
    <div className="space-y-6">
      <ReportsPanel constituency={c} />
      {(FLAGS.officeRelease11 || FLAGS.consultations) && <OfficeR11 constituency={c} />}
    </div>
  ));
}
