import PlannedPanel from "@/components/ui/PlannedPanel";
import { dict, getLang } from "@/lib/i18n";
import { officePage } from "@/lib/office-page";

export default async function Page() {
  const t = dict[await getLang()];
  return officePage("/office/audit", (x) => x.owAuditTitle, null, () => <PlannedPanel title={t.owAuditPlannedTitle} body={t.owAuditPlannedBody} />);
}
