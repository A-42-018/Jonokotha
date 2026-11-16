"use client";
import { useQuery } from "@tanstack/react-query";
import QueryProvider from "@/components/QueryProvider";
import { useT } from "@/components/ui/useT";
import { fetchIssuesPage } from "@/lib/explore-api";
import HotspotMap from "./HotspotMap";

export default function HotspotMapLive() {
  return <QueryProvider><MapInner /></QueryProvider>;
}

/** Public issues at their approximate positions (the same data as /area), never exact addresses. */
function MapInner() {
  const t = useT();
  const q = useQuery({ queryKey: ["hotspot-issues"], queryFn: () => fetchIssuesPage(undefined, "all") });
  if (q.isPending) return <p role="status" className="text-muted">{t.exLoading}</p>;
  if (q.isError) return <p role="alert" className="text-sm">{t.adLoadError}</p>;
  return <HotspotMap issues={q.data.items.filter((i) => !i.sample)} />;
}
