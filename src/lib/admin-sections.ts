import { R2 } from "@/lib/flags-r2";
import type { Dict } from "@/lib/i18n";

/** Every admin page in menu order (masterplan §6.4). `live` means at least one control on the page works on the server today. */
export function adminSections(t: Dict) {
  return [
    { href: "/admin/users", nav: t.acNavUsers, title: t.acUsersTitle, lead: t.acUsersLead, live: true },
    { href: "/admin/constituencies", nav: t.acNavAreas, title: t.acAreasTitle, lead: t.acAreasLead, live: true },
    { href: "/admin/representatives", nav: t.acNavReps, title: t.acRepsTitle, lead: t.acRepsLead, live: true },
    { href: "/admin/verification", nav: t.adNavVerify, title: t.adVerifyTitle, lead: t.adVerifyLead, live: true },
    { href: "/admin/categories", nav: t.acNavCats, title: t.acCatTitle, lead: t.acCatLead, live: false },
    { href: "/admin/moderation", nav: t.adNavMod, title: t.adModTitle, lead: t.adModLead, live: true },
    { href: "/admin/appeals", nav: t.acNavAppeals, title: t.acAppealsTitle, lead: t.acAppealsLead, live: false },
    { href: "/admin/health", nav: t.acNavHealth, title: t.acHealthTitle, lead: t.acHealthLead, live: true },
    { href: "/admin/security", nav: t.acNavSecurity, title: t.acSecTitle, lead: t.acSecLead, live: false },
    { href: "/admin/audit", nav: t.adNavAudit, title: t.adAuditPageTitle, lead: t.adAuditLead, live: true },
    { href: "/admin/integrations", nav: t.acNavInteg, title: t.acIntTitle, lead: t.acIntLead, live: false },
    { href: "/admin/flags", nav: t.acNavFlags, title: t.acFlagsTitle, lead: t.acFlagsLead, live: false },
    { href: "/admin/knowledge", nav: t.acNavKnow, title: t.acKnowTitle, lead: t.acKnowLead, live: true },
    { href: "/admin/ai-runs", nav: t.adNavAi, title: t.adAiTitle, lead: t.adAiLead, live: true },
    { href: "/admin/ai-evals", nav: t.acNavEvals, title: t.acEvalTitle, lead: t.acEvalLead, live: true },
    { href: "/admin/stats", nav: t.adNavStats, title: t.adStatsTitle, lead: t.adStatsLead, live: true },
    { href: "/admin/demo", nav: t.acNavDemo, title: t.acDemoTitle, lead: t.acDemoLead, live: false },
    ...(R2.admin ? [
      { href: "/admin/budget", nav: t.r2BgAdminTitle, title: t.r2BgAdminTitle, lead: t.r2BgAdminLead, live: true },
      { href: "/admin/mp-records", nav: t.r2MrAdminTitle, title: t.r2MrAdminTitle, lead: t.r2MrAdminLead, live: true },
      { href: "/admin/regional-admins", nav: t.r2RgAdminTitle, title: t.r2RgAdminTitle, lead: t.r2RgAdminLead, live: true },
      { href: "/admin/countries", nav: t.r2CrTitle, title: t.r2CrTitle, lead: t.r2CrLead, live: true },
    ] : []),
  ] as const;
}
