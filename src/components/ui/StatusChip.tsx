import type { Status } from "@/lib/types";
import Badge, { type BadgeTone } from "./Badge";

const STYLE: Record<Status, { tone: BadgeTone; icon: string }> = {
  received: { tone: "info", icon: "●" },
  acknowledged: { tone: "warning", icon: "◐" },
  referred: { tone: "teal", icon: "➜" },
  resolved: { tone: "success", icon: "✓" },
};

/** Case status pill: colour + icon + text, never colour alone. */
export default function StatusChip({ status, label }: { status: Status; label: string }) {
  const s = STYLE[status];
  return <Badge tone={s.tone} icon={s.icon}>{label}</Badge>;
}
