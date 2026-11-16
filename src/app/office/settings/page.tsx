import PlannedPanel from "@/components/ui/PlannedPanel";
import { dict, getLang } from "@/lib/i18n";
import { officePage } from "@/lib/office-page";

export default async function Page() {
  const t = dict[await getLang()];
  return officePage("/office/settings", (x) => x.owSetTitle, null, () => (
    <div className="grid gap-3 md:grid-cols-2">
      <PlannedPanel title={t.owSetSlaTitle} body={t.owSetSlaBody} />
      <PlannedPanel title={t.owSetCatTitle} body={t.owSetCatBody} />
    </div>
  ));
}
