import type { Status } from "@/lib/types";

const STYLE: Record<Status, { cls: string; icon: string }> = {
  received: { cls: "border-civic/40 bg-civic/10 text-civic", icon: "●" },
  acknowledged: { cls: "border-amber/60 bg-amber/20 text-amber-900", icon: "◐" },
  referred: { cls: "border-teal/40 bg-teal/10 text-teal", icon: "➜" },
  resolved: { cls: "border-leaf/50 bg-leaf/10 text-green-800", icon: "✓" },
};

/** Status pill: colour + icon + text, never colour alone. */
export default function StatusChip({ status, label }: { status: Status; label: string }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {label}
    </span>
  );
}
