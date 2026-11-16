import PanelSidebar from "@/components/ui/PanelSidebar";
import { dict, getLang } from "@/lib/i18n";

/** Admin workspace frame (same navy menu as the office). Each page still guards the admin role itself. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const t = dict[await getLang()];
  const links = [["/admin", t.adNavHome, true], ["/admin/verification", t.adNavVerify, false], ["/admin/moderation", t.adNavMod, false], ["/admin/ai-runs", t.adNavAi, false], ["/admin/stats", t.adNavStats, false]] as const;
  return (
    <div className="grid gap-4 lg:grid-cols-[13rem_1fr]">
      <PanelSidebar aria={t.adNavAria} title={t.appName} links={links.map(([href, label, exact]) => ({ href, label, exact }))} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
