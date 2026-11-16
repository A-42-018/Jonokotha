import Link from "next/link";
import OfficeKpis from "@/components/office/OfficeKpis";
import NoAccess from "@/components/ui/NoAccess";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { guardStaff } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

export default async function OfficeKpisPage() {
  const t = dict[await getLang()];
  const { denied } = await guardStaff("/office/kpis");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/office/kpis" />;
  return (
    <div className="space-y-4">
      <Link href="/office" className="inline-flex min-h-11 items-center text-civic underline">← {t.mxOfficeBack}</Link>
      <h1 className="text-2xl font-semibold text-civic">{t.mxOfficeTitle}</h1>
      <p className="text-muted">{t.mxOfficeLead}</p>
      <OfficeKpis constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} />
    </div>
  );
}
