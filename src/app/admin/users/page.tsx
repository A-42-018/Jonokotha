import { UsersPanel } from "@/components/admin/console/AdminConsole";
import { adminPage, planned } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/users", (t) => t.acUsersTitle, (t) => t.acUsersLead, (t) => (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t.acLiveOnly}</p>
      <UsersPanel />
      {planned("adminUserList", t.acUsersListTitle, t.acUsersListBody)}
    </div>
  ));
}
