import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import NoAccess from "@/components/ui/NoAccess";
import { guardAdmin } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

export default async function AdminHome() {
  const t = dict[await getLang()];
  const { denied } = await guardAdmin("/admin");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/admin" />;
  const items = [["/admin/verification", t.adVerifyTitle, t.adVerifyLead], ["/admin/moderation", t.adModTitle, t.adModLead], ["/admin/ai-runs", t.adAiTitle, t.adAiLead], ["/admin/stats", t.adStatsTitle, t.adStatsLead]];
  return (
    <AdminShell t={t} title={t.adTitle} lead={t.adHomeLead} current="/admin">
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map(([href, title, lead]) => (
          <li key={href}><Card title={<Link href={href} className="underline">{title}</Link>}><p className="text-muted">{lead}</p></Card></li>
        ))}
      </ul>
    </AdminShell>
  );
}
