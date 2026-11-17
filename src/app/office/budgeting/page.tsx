import { notFound } from "next/navigation";
import { PbOffice } from "@/components/r2/Pb";
import { R2 } from "@/lib/flags-r2";
import { officePage } from "@/lib/office-page";

export default async function Page() {
  if (!R2.budgeting) notFound();
  return officePage("/office/budgeting", (x) => x.r2PbOfficeTitle, (x) => x.r2PbOfficeLead, (c) => <PbOffice constituency={c} />);
}
