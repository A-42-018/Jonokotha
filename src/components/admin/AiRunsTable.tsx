"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fetchAiRuns } from "@/lib/admin-api";
import { fmtDate, fmtNum } from "@/lib/format";

export default function AiRunsTable() {
  return <QueryProvider><RunsInner /></QueryProvider>;
}

/** AI run log: metadata only (agent, model, prompt version, result, staff decision, time, cost). Never prompts or report text. */
function RunsInner() {
  const t = useT();
  const lang = useLang();
  const q = useInfiniteQuery({ queryKey: ["ai-runs"], queryFn: ({ pageParam }) => fetchAiRuns(pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: (l) => l.next ?? undefined });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (q.isPending) return <p role="status" className="text-muted">{t.exLoading}</p>;
  if (q.isError) return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{t.adLoadError}</p><Button variant="secondary" onClick={() => void q.refetch()}>{t.exRetry}</Button></div>;
  return (
    <div className="space-y-3">
      <Table
        caption={t.adAiCaption}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<p className="text-muted">{t.adAiEmpty}</p>}
        columns={[
          { key: "at", header: t.adAiColTime, nowrap: true, cell: (r) => fmtDate(r.created_at, lang) },
          { key: "agent", header: t.adAiColAgent, primary: true, cell: (r) => r.agent },
          { key: "model", header: t.adAiColModel, cell: (r) => r.model ?? "—" },
          { key: "prompt", header: t.adAiColPrompt, cell: (r) => r.prompt_version ?? "—" },
          { key: "status", header: t.adAiColStatus, cell: (r) => r.status },
          { key: "dec", header: t.adAiColDecision, cell: (r) => t[`adDec_${r.decision ?? "pending"}` as keyof typeof t] as string ?? r.decision },
          { key: "lat", header: t.adAiColLatency, align: "end", cell: (r) => (r.latency_ms == null ? "—" : fmtNum(r.latency_ms, lang)) },
          { key: "cost", header: t.adAiColCost, align: "end", cell: (r) => (r.cost_usd == null ? "—" : String(r.cost_usd)) },
        ]}
      />
      {q.hasNextPage && <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t.exLoadMore}</Button>}
    </div>
  );
}
