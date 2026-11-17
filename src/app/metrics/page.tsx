import Link from "next/link";
import Card from "@/components/ui/Card";
import { dict, getLang } from "@/lib/i18n";
import { PUBLIC_METRICS } from "@/lib/metrics";

export default async function Metrics() {
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.mxTitle}</h1>
      <p className="text-muted">{t.mxLead}</p>
      <Card tone="info">
        <ul className="list-disc space-y-1 ps-5"><li>{t.mxNoRank}</li><li>{t.mxSmall}</li><li>{t.mxSample}</li></ul>
      </Card>
      {PUBLIC_METRICS.map((m) => (
        <Card key={m.id} id={m.id} title={t[`mx_${m.id}` as const]} className="scroll-mt-20">
          <dl className="space-y-2">
            <div><dt className="sr-only">{t.mxHow}</dt><dd>{t[`mx_${m.id}_def` as const]}</dd></div>
            <div><dt className="text-sm font-medium">{t.mxWindowLabel}</dt><dd className="text-muted">{t[m.window]}</dd></div>
            <div><dt className="text-sm font-medium">{t.mxLimitLabel}</dt><dd className="text-muted">{t[`mx_${m.id}_limit` as const]}</dd></div>
          </dl>
        </Card>
      ))}
      <Link href="/mp" className="inline-flex min-h-11 items-center text-civic underline">{t.mxBackFind}</Link>
    </div>
  );
}
