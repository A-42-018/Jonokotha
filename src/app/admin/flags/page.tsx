import { adminPage, planned } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/flags", (t) => t.acFlagsTitle, (t) => t.acFlagsLead, (t) => planned("adminFlags", t.acFlagsT, t.acFlagsB));
}
