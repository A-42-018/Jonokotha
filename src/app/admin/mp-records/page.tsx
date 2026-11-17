import { notFound } from "next/navigation";
import { MpRecordsAdmin } from "@/components/r2/MpRecords";
import { adminPage } from "@/lib/admin-page";
import { R2 } from "@/lib/flags-r2";

export default async function Page() {
  if (!R2.admin) notFound();
  return adminPage("/admin/mp-records", (t) => t.r2MrAdminTitle, (t) => t.r2MrAdminLead, () => <MpRecordsAdmin />);
}
