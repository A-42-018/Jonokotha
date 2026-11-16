import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { dict, getLang } from "@/lib/i18n";

export default async function Privacy() {
  const t = dict[await getLang()];
  const list = (items: string[]) => <ul className="list-disc space-y-1 ps-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.pvTitle}</h1>
      <Card tone="warning"><Badge tone="warning">{t.exSample}</Badge><p className="mt-2">{t.pvDraft}</p></Card>
      <Card title={t.pvDataTitle}>{list([t.pvData1, t.pvData2, t.pvData3])}</Card>
      <Card title={t.pvPublicTitle}>{list([t.pvPublic1, t.pvPublic2])}</Card>
      <Card title={t.pvAiTitle}>{list([t.pvAi1, t.pvAi2])}</Card>
      <Card title={t.pvRulesTitle}>{list([t.pvRules1, t.pvRules2, t.pvRules3])}</Card>
      <Card title={t.pvOpenTitle}>{list([t.pvOpen1, t.pvOpen2])}</Card>
    </div>
  );
}
