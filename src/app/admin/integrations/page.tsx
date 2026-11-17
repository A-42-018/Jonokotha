import { adminPage, planned } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/integrations", (t) => t.acIntTitle, (t) => t.acIntLead, (t) => planned("adminIntegrations", t.acIntT, t.acIntB));
}
