import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import KpiPanel from "@/components/admin/KpiPanel";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import NoAccess from "@/components/ui/NoAccess";
import { adminSections } from "@/lib/admin-sections";
import { guardAdmin } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

/** Platform overview (§6.4): live KPIs with their definitions, then every admin section and whether it works yet. */
export default async function AdminHome() {
  const t = dict[await getLang()];
  const { denied } = await guardAdmin("/admin");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/admin" />;
  return (
    <AdminShell t={t} title={t.adTitle} lead={t.acOvLead} current="/admin">
      <KpiPanel />
      <h2 className="jk-h2">{t.acOvSections}</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {adminSections(t).map((s) => (
          <li key={s.href}>
            <Card title={<Link href={s.href} className="underline">{s.title}</Link>} headingAs="h3">
              <p className="mb-2 text-muted">{s.lead}</p>
              <Badge tone={s.live ? "success" : "neutral"}>{s.live ? t.acSecLive : t.acSecPlanned}</Badge>
            </Card>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
