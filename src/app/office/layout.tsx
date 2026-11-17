import PanelSidebar from "@/components/ui/PanelSidebar";
import { dict, getLang } from "@/lib/i18n";

/** Office workspace frame (masterplan §6.3): navy side menu from lg, a scrolling strip on phones. Each page still guards the staff role itself. */
export default async function OfficeLayout({ children }: LayoutProps<"/office">) {
  const t = dict[await getLang()];
  const links = [
    { href: "/office", label: t.owNavOverview, exact: true },
    { href: "/office/mine", label: t.owNavMine },
    { href: "/office/issues", label: t.owNavAll },
    { href: "/office/ideas", label: t.owNavIdeas },
    { href: "/office/questions", label: t.owNavQuestions },
    { href: "/office/projects", label: t.owNavProjects },
    { href: "/office/polls", label: t.owNavPolls },
    { href: "/office/analytics", label: t.owNavAnalytics },
    { href: "/office/announcements", label: t.odAnnouncements },
    { href: "/office/agency", label: t.lsNav },
    { href: "/office/staff", label: t.owNavStaff },
    { href: "/office/audit", label: t.owNavAudit },
    { href: "/office/settings", label: t.owNavSettings },
    { href: "/office/help", label: t.otOpen },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[13rem_1fr]">
      <PanelSidebar aria={t.rfOfficeNav} title={t.appName} links={links} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
