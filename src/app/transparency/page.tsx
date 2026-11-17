import Link from "next/link";
import { notFound } from "next/navigation";
import Card from "@/components/ui/Card";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * Hub of the Release 2 public pages (F8.*). It exists so the menus on every page do not grow (the first-load budget has 62 bytes left).
 * It lists only the sections whose flag is on, and is linked from About and Help when any is.
 */
export default async function Transparency() {
  const t = dict[await getLang()];
  const items = [
    R2.budget && { href: "/budget", title: t.r2BgTitle, lead: t.r2BgLead },
    R2.budgeting && { href: "/budgeting", title: t.r2PbTitle, lead: t.r2PbLead },
    R2.openData && { href: "/open-data", title: t.r2OdTitle, lead: t.r2OdLead },
    R2.mpRecords && { href: "/mp-records", title: t.r2MrTitle, lead: t.r2MrLead },
    R2.rti && { href: "/rti", title: t.r2RtTitle, lead: t.r2RtLead },
    R2.assisted && { href: "/volunteer", title: t.r2AsTitle, lead: t.r2AsLead },
  ].filter(Boolean) as { href: string; title: string; lead: string }[];
  if (items.length === 0) notFound();
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.r2Hub}</h1>
      <p className="text-muted">{t.r2HubLead}</p>
      <ul className="grid gap-3 md:grid-cols-2">{items.map((i) => <li key={i.href}><Card title={<Link href={i.href} className="underline">{i.title}</Link>} headingAs="h2"><p className="text-muted">{i.lead}</p></Card></li>)}</ul>
    </div>
  );
}
