import Link from "next/link";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { buttonClass } from "@/components/ui/Button";
import { dict, getLang } from "@/lib/i18n";

/** Polls and surveys (masterplan 6.2). The server has no polls yet (backend B5.5), so this page says so and offers nothing to press. */
export default async function Polls() {
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.plTitle}</h1>
      <PlannedPanel title={t.plPlannedTitle} body={t.plPlannedBody} />
      <Link href="/" className={buttonClass({ variant: "secondary" })}>{t.plBack}</Link>
    </div>
  );
}
