import { PageLink } from "@/components/admin/console/AdminConsole";
import { adminPage, planned } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/appeals", (t) => t.acAppealsTitle, (t) => t.acAppealsLead, (t) => planned("adminAppeals", t.acAppealsT, t.acAppealsB, <PageLink href="/admin/moderation">{t.acModLink}</PageLink>));
}
