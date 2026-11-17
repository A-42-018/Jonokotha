import { notFound } from "next/navigation";
import { BudgetAdmin } from "@/components/r2/BudgetOffice";
import { adminPage } from "@/lib/admin-page";
import { R2 } from "@/lib/flags-r2";

export default async function Page() {
  if (!R2.admin) notFound();
  return adminPage("/admin/budget", (t) => t.r2BgAdminTitle, (t) => t.r2BgAdminLead, () => <BudgetAdmin />);
}
