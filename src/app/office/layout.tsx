import PanelSidebar from "@/components/ui/PanelSidebar";
import { FLAGS } from "@/lib/flags-more";
import { R2 } from "@/lib/flags-r2";
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
    ...(FLAGS.consultations || FLAGS.officeRelease11 ? [{ href: "/office/consultations", label: t.ofcTitle }] : []),
    ...(FLAGS.commitments || FLAGS.officeRelease11 ? [{ href: "/office/commitments", label: t.tkoTitle }] : []),
    ...(FLAGS.priorities || FLAGS.officeRelease11 ? [{ href: "/office/priorities", label: t.prxoTitle }] : []),
    ...(R2.budget ? [{ href: "/office/budget", label: t.r2BgOfficeTitle }] : []),
    ...(R2.budgeting ? [{ href: "/office/budgeting", label: t.r2PbOfficeTitle }] : []),
    ...(R2.assisted ? [{ href: "/office/volunteers", label: t.r2AsOfficeTitle }] : []),
    ...(R2.regional ? [{ href: "/office/region", label: t.r2RgTitle }] : []),
    { href: "/office/analytics", label: t.owNavAnalytics },
    { href: "/office/announcements", label: t.odAnnouncements },
    { href: "/office/agency", label: t.lsNav },
    { href: "/office/staff", label: t.owNavStaff },
    { href: "/office/audit", label: t.owNavAudit },
    { href: "/office/settings", label: t.owNavSettings },
    { href: "/office/help", label: t.otOpen },
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <PanelSidebar aria={t.rfOfficeNav} title={t.appName} links={links} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
