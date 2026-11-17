import PlannedPanel from "@/components/ui/PlannedPanel";
import { dict, getLang } from "@/lib/i18n";
import { officePage } from "@/lib/office-page";

export default async function Page() {
  const t = dict[await getLang()];
  return officePage("/office/polls", (x) => x.owPollsTitle, null, () => <PlannedPanel title={t.owPollsPlannedTitle} body={t.owPollsPlannedBody} />);
}
