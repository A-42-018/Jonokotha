import { adminPage, planned } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/demo", (t) => t.acDemoTitle, (t) => t.acDemoLead, (t) => planned("adminDemo", t.acDemoT, t.acDemoB));
}
