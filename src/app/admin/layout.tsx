import PanelSidebar from "@/components/ui/PanelSidebar";
import { adminSections } from "@/lib/admin-sections";
import { dict, getLang } from "@/lib/i18n";

/** Admin workspace frame (same navy menu as the office). Each page still guards the admin role itself. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const t = dict[await getLang()];
  const links = [{ href: "/admin", label: t.adNavHome, exact: true }, ...adminSections(t).map((s) => ({ href: s.href, label: s.nav }))];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <PanelSidebar aria={t.adNavAria} title={t.appName} links={links} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
