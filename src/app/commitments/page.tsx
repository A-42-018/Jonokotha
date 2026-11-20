import { flagOrDemo } from "@/lib/demo-mode-server";
import { notFound } from "next/navigation";
import CommitmentsList from "@/components/tracker/CommitmentsList";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { FLAGS } from "@/lib/flags";
import { dict, getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Commitment tracker (F7.7, Release 1.1). With the flag off the page does not exist. */
export default async function Commitments() {
  if (!(await flagOrDemo(FLAGS.commitments))) notFound();
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.tkHeading}</h1>
      <p className="text-muted">{t.tkLead}</p>
      <CommitmentsList constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} />
    </div>
  );
}
