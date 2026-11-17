import { notFound } from "next/navigation";
import { CountryReadinessPanel } from "@/components/r2/Country";
import { adminPage } from "@/lib/admin-page";
import { R2 } from "@/lib/flags-r2";

export default async function Page() {
  if (!R2.admin) notFound();
  return adminPage("/admin/countries", (t) => t.r2CrTitle, (t) => t.r2CrLead, () => <CountryReadinessPanel />);
}
