import { notFound } from "next/navigation";
import BudgetOffice from "@/components/r2/BudgetOffice";
import { R2 } from "@/lib/flags-r2";
import { officePage } from "@/lib/office-page";

export default async function Page() {
  if (!R2.budget) notFound();
  return officePage("/office/budget", (x) => x.r2BgOfficeTitle, (x) => x.r2BgOfficeLead, (c) => <BudgetOffice constituency={c} />);
}
