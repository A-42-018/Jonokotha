import PanelSidebar from "@/components/ui/PanelSidebar";
import { dict, getLang } from "@/lib/i18n";

/** Office workspace frame: navy side menu from lg, a scrolling strip on phones. Each page still guards the staff role itself. */
export default async function OfficeLayout({ children }: LayoutProps<"/office">) {
  const t = dict[await getLang()];
  return (
    <div className="grid gap-4 lg:grid-cols-[13rem_1fr]">
      <PanelSidebar aria={t.rfOfficeNav} title={t.appName} links={[{ href: "/office", label: t.odOverview, exact: true }, { href: "/office/announcements", label: t.odAnnouncements }]} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
