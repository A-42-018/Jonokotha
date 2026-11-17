"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum } from "@/lib/format";
import { datasetUrl, fetchDataset, fetchOpenData } from "@/lib/r2-api";
import { Ext, Gate } from "./bits";

/** Open-data portal (F8.4): the catalogue with the licence and the credit line; each dataset with a preview and downloads. */
export function OpenDataList() {
  return <QueryProvider><List /></QueryProvider>;
}

function Licence({ licence }: { licence: { code: string; name: string; url: string; reviewed: boolean } | null }) {
  const t = useT();
  if (!licence) return <p className="text-sm text-muted">{t.r2OdUnreviewedHold}</p>;
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">{t.r2OdLicence}: <Ext href={licence.url}>{licence.name || licence.code}</Ext></p>
      {!licence.reviewed && <p role="note" className="text-amber-900">{t.r2OdLicenceDraft}</p>}
    </div>
  );
}

function List() {
  const t = useT();
  const q = useQuery({ queryKey: ["open-data"], queryFn: fetchOpenData, retry: false });
  return (
    <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
      <Gate data={q.data}>
        {(c) => (
          <div className="space-y-4">
            <Card><Licence licence={c.licence} /><p className="mt-2 text-sm">{t.r2OdAttribution}</p><p className="mt-1 text-sm text-muted">{t.r2OdMin}</p></Card>
            {c.datasets.length === 0 ? <EmptyState title={t.r2OdEmpty} /> : (
              <ul className="space-y-3">
                {c.datasets.map((d) => <DatasetCard key={d.slug} d={d} />)}
              </ul>
            )}
          </div>
        )}
      </Gate>
    </AsyncBlock>
  );
}

function DatasetCard({ d }: { d: { slug: string; title_en: string; title_bn: string; description_en: string; update_frequency: "live" | "daily" | "monthly" } }) {
  const t = useT();
  const lang = useLang();
  return (
    <li>
      <Card as="article" title={lang === "bn" ? d.title_bn || d.title_en : d.title_en} headingAs="h2">
        <Badge tone="teal">{t[`r2OdUpdate_${d.update_frequency}`]}</Badge>
        <p className="mt-2 text-muted">{d.description_en}</p>
        <Link href={`/open-data/${encodeURIComponent(d.slug)}`} className={`${buttonClass({ variant: "secondary" })} mt-3`}>{t.r2OdOpen}</Link>
      </Card>
    </li>
  );
}

export function OpenDataSet({ slug, constituency }: { slug: string; constituency?: string }) {
  return <QueryProvider><One slug={slug} constituency={constituency} /></QueryProvider>;
}

function One({ slug, constituency }: { slug: string; constituency?: string }) {
  const t = useT();
  const lang = useLang();
  const cat = useQuery({ queryKey: ["open-data"], queryFn: fetchOpenData, retry: false });
  const q = useQuery({ queryKey: ["open-data", slug, constituency], queryFn: () => fetchDataset(slug, constituency), retry: false });
  const meta = cat.data?.kind === "ok" ? cat.data.data.datasets.find((x) => x.slug === slug) : undefined;
  return (
    <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
      <Gate data={q.data}>
        {(d) => {
          const cols = d.rows[0] ? Object.keys(d.rows[0]) : meta?.columns.map((c) => c.name) ?? [];
          return (
            <div className="space-y-4">
              <Card>
                <Licence licence={d.licence} />
                <p className="mt-2 text-sm">{t.r2OdAttribution}</p>
                <p className="mt-1 text-sm text-muted">{d.privacy_note}</p>
                {d.hidden_cells > 0 && <p className="mt-1 text-sm">{fillNum(t.r2OdHidden, { n: d.hidden_cells }, lang)}</p>}
                <p className="mt-1 text-sm text-muted">{fillNum(t.r2OdRows, { n: d.row_count }, lang)} · {t.r2OdLimit}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={datasetUrl(slug, "csv", constituency)} download className={buttonClass()}>{t.r2OdDownloadCsv}</a>
                  <a href={datasetUrl(slug, "json", constituency)} download className={buttonClass({ variant: "secondary" })}>{t.r2OdDownloadJson}</a>
                </div>
              </Card>
              {cols.length > 0 && (
                <section aria-labelledby="od-prev" className="space-y-2">
                  <h2 id="od-prev" className="jk-h2">{t.r2OdPreview}</h2>
                  <div className="overflow-x-auto rounded-xl border border-line bg-white">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">{t.r2OdPreview}</caption>
                      <thead><tr>{cols.map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr></thead>
                      <tbody>{d.rows.slice(0, 10).map((r, i) => <tr key={i} className="border-t border-line">{cols.map((c) => <td key={c} className="px-3 py-2">{r[c] ?? ""}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </section>
              )}
              <Link href="/open-data" className="inline-flex min-h-11 items-center text-civic underline">{t.r2OdBack}</Link>
            </div>
          );
        }}
      </Gate>
    </AsyncBlock>
  );
}
