import { notFound } from "next/navigation";
import ConsultationsOffice from "@/components/consult/ConsultationsOffice";
import { FLAGS } from "@/lib/flags-more";
import { officePage } from "@/lib/office-page";

export default async function Page() {
  if (!FLAGS.officeRelease11 && !FLAGS.consultations) notFound();
  return officePage("/office/consultations", (x) => x.ofcTitle, (x) => x.ofcLead, (c) => <ConsultationsOffice constituency={c} />);
}
