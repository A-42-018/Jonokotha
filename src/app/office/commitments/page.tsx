import { notFound } from "next/navigation";
import CommitmentsOffice from "@/components/office/ws/CommitmentsOffice";
import { FLAGS } from "@/lib/flags-more";
import { officePage } from "@/lib/office-page";

export default async function Page() {
  if (!FLAGS.commitments && !FLAGS.officeRelease11) notFound();
  return officePage("/office/commitments", (x) => x.tkoTitle, (x) => x.tkoLead, (c) => <CommitmentsOffice constituency={c} />);
}
