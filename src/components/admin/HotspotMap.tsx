"use client";
import dynamic from "next/dynamic";
import type { ExploreIssue } from "@/lib/explore";

const ExploreMap = dynamic(() => import("@/components/explore/ExploreMap"), { ssr: false });

/** Clustered map of sample issues (real reports have no pin yet). Dense clusters are the hotspots. */
export default function HotspotMap({ issues }: { issues: ExploreIssue[] }) {
  return <ExploreMap issues={issues} onSelect={() => {}} />;
}
