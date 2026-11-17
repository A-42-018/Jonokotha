import { AgencyKeys } from "@/components/r2/Country";
import { adminPage, planned } from "@/lib/admin-page";
import { R2 } from "@/lib/flags-r2";

export default function Page() {
  return adminPage("/admin/integrations", (t) => t.acIntTitle, (t) => t.acIntLead, (t) => (
    <>
      {planned("adminIntegrations", t.acIntT, t.acIntB)}
      {R2.admin && <section aria-labelledby="ag-keys" className="space-y-3"><h2 id="ag-keys" className="jk-h2">{t.r2AgTitle}</h2><p className="text-muted">{t.r2AgLead}</p><AgencyKeys /></section>}
    </>
  ));
}
