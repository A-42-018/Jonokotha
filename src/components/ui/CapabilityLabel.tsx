"use client";
import type { DataStatus } from "@/lib/capability";
import Badge, { type BadgeTone } from "./Badge";
import { useT } from "./useT";

const TONE: Record<DataStatus, BadgeTone> = { live: "success", sample: "warning", demo: "warning", planned: "neutral" };
const ICON: Record<DataStatus, string> = { live: "●", sample: "◐", demo: "◑", planned: "○" };

/**
 * One label for the four capability states (lib/capability.ts). Live is silent unless `showLive`, so real data
 * is not buried in badges. The icon differs per state, so meaning never rests on colour alone.
 */
export default function CapabilityLabel({ status, showLive = false, className }: { status: DataStatus; showLive?: boolean; className?: string }) {
  const t = useT();
  if (status === "live" && !showLive) return null;
  const text = status === "live" ? t.capLive : status === "sample" ? t.capSample : status === "demo" ? t.capDemo : t.capPlanned;
  const hint = status === "sample" ? t.capSampleHint : status === "demo" ? t.capDemoHint : status === "planned" ? t.capPlannedHint : undefined;
  return (
    <Badge tone={TONE[status]} icon={ICON[status]} className={className}>
      <span title={hint} data-capability={status}>{text}</span>
    </Badge>
  );
}
