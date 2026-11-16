import AdminShell from "@/components/admin/AdminShell";
import NoAccess from "@/components/ui/NoAccess";
import Table from "@/components/ui/Table";
import { SAMPLE_AI_RUNS } from "@/lib/admin";
import { guardAdmin } from "@/lib/guard";
import { dict, fmtDate, fmtNum, getLang } from "@/lib/i18n";

export default async function AiRuns() {
  const lang = await getLang();
  const t = dict[lang];
  const { denied } = await guardAdmin("/admin/ai-runs");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/admin/ai-runs" />;
  return (
    <AdminShell t={t} title={t.adAiTitle} lead={t.adAiLead} current="/admin/ai-runs">
      <Table
        caption={t.adAiCaption}
        rows={SAMPLE_AI_RUNS}
        rowKey={(r) => r.id}
        columns={[
          { key: "at", header: t.adAiColTime, nowrap: true, cell: (r) => fmtDate(r.at, lang) },
          { key: "agent", header: t.adAiColAgent, primary: true, cell: (r) => r.agent },
          { key: "model", header: t.adAiColModel, cell: (r) => r.model },
          { key: "prompt", header: t.adAiColPrompt, cell: (r) => r.promptVersion },
          { key: "ref", header: t.adAiColRef, nowrap: true, cell: (r) => r.ref },
          { key: "conf", header: t.adAiColConf, cell: (r) => `${fmtNum(Math.round(r.confidence * 100), lang)}%` },
          { key: "dec", header: t.adAiColDecision, cell: (r) => t[`adDec_${r.humanDecision}` as keyof typeof t] as string },
          { key: "lat", header: t.adAiColLatency, align: "end", cell: (r) => fmtNum(r.latencyMs, lang) },
        ]}
      />
    </AdminShell>
  );
}
