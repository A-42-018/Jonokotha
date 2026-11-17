"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fetchAudit } from "@/lib/admin-api";
import { fmtDate } from "@/lib/format";

export default function AuditTable() {
  return <QueryProvider><AuditInner /></QueryProvider>;
}

/** Audit trail (who did what, to what, when). Reading it is itself audited by the server. Before and after values are not shown here. */
function AuditInner() {
  const t = useT();
  const lang = useLang();
  const q = useInfiniteQuery({ queryKey: ["audit"], queryFn: ({ pageParam }) => fetchAudit(pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: (l) => l.next ?? undefined });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (q.isPending) return <p role="status" className="text-muted">{t.exLoading}</p>;
  if (q.isError) return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{t.adLoadError}</p><Button variant="secondary" onClick={() => void q.refetch()}>{t.exRetry}</Button></div>;
  return (
    <div className="space-y-3">
      <Table
        caption={t.adAuditCaption}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<p className="text-muted">{t.adAuditEmpty}</p>}
        columns={[
          { key: "at", header: t.adAiColTime, nowrap: true, cell: (r) => fmtDate(r.created_at, lang) },
          { key: "action", header: t.adAuditColAction, primary: true, cell: (r) => r.action },
          { key: "who", header: t.adAuditColWho, cell: (r) => r.actor_role ?? r.actor_kind ?? "—" },
          { key: "what", header: t.adAuditColWhat, cell: (r) => `${r.resource_type}${r.resource_id ? ` · ${r.resource_id}` : ""}` },
        ]}
      />
      {q.hasNextPage && <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t.exLoadMore}</Button>}
    </div>
  );
}
