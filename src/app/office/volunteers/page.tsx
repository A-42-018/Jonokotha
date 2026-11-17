import { notFound } from "next/navigation";
import { VolunteersOffice } from "@/components/r2/Assisted";
import { R2 } from "@/lib/flags-r2";
import { officePage } from "@/lib/office-page";

export default async function Page() {
  if (!R2.assisted) notFound();
  return officePage("/office/volunteers", (x) => x.r2AsOfficeTitle, (x) => x.r2AsOfficeLead, (c) => <VolunteersOffice constituency={c} />);
}
