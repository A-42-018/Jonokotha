import { notFound } from "next/navigation";
import PrioritiesOffice from "@/components/office/ws/PrioritiesOffice";
import { FLAGS } from "@/lib/flags-more";
import { officePage } from "@/lib/office-page";

export default async function Page() {
  if (!FLAGS.priorities && !FLAGS.officeRelease11) notFound();
  return officePage("/office/priorities", (x) => x.prxoTitle, (x) => x.prxoLead, (c) => <PrioritiesOffice constituency={c} />);
}
