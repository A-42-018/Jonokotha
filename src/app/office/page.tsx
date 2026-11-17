import CaseTable from "@/components/office/CaseTable";
import OfficeCharts from "@/components/office/OfficeCharts";
import OfficeTour from "@/components/office/OfficeTour";
import Overview from "@/components/office/Overview";
import NoAccess from "@/components/ui/NoAccess";
import State from "@/components/ui/State";
import { dict, getLang } from "@/lib/i18n";
import { nowMs } from "@/lib/explore";
import { overviewStats } from "@/lib/office";
import { listCases } from "@/lib/store";
import { guardStaff } from "@/lib/guard";

export default async function Office() {
  const lang = await getLang();
  const t = dict[lang];
  const { sb, denied } = await guardStaff("/office");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/office" />;
  const cases = await listCases(sb);
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.odOverview}</h1>
      <OfficeTour />
      <Overview o={overviewStats(cases, nowMs())} t={t} lang={lang} />
      <OfficeCharts cases={cases} t={t} lang={lang} />
      {cases.length === 0 ? <State kind="officeEmpty" title={t.emptyQueue} as="h2" /> : <CaseTable cases={cases} />}
    </div>
  );
}
