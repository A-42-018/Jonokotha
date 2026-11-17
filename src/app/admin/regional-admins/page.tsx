import { notFound } from "next/navigation";
import { RegionalAdmins } from "@/components/r2/Regional";
import { adminPage } from "@/lib/admin-page";
import { R2 } from "@/lib/flags-r2";

export default async function Page() {
  if (!R2.admin) notFound();
  return adminPage("/admin/regional-admins", (t) => t.r2RgAdminTitle, (t) => t.r2RgAdminLead, () => <RegionalAdmins />);
}
