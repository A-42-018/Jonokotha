import { notFound } from "next/navigation";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { FLAGS } from "@/lib/flags";
import { dict, getLang } from "@/lib/i18n";

/** Release 1.1. With the flag off (the default) the page does not exist, so nothing links to a dead end. */
export default async function Consultations() {
  if (!FLAGS.consultations) notFound();
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.coTitle}</h1>
      <PlannedPanel title={t.coPlannedTitle} body={t.coPlannedBody} />
    </div>
  );
}
