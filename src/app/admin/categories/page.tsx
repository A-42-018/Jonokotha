import { adminPage, planned } from "@/lib/admin-page";

export default function Page() {
  return adminPage("/admin/categories", (t) => t.acCatTitle, (t) => t.acCatLead, (t) => (
    <div className="grid gap-4 md:grid-cols-2">
      {planned("adminCategories", t.acCatListT, t.acCatListB)}
      {planned("adminSla", t.acSlaT, t.acSlaB)}
    </div>
  ));
}
