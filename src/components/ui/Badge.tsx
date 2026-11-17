import type { ReactNode } from "react";
import { cx } from "./cx";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "warningOnDark" | "teal" | "danger";

// Text colours are the AA-safe tokens (>= 4.5:1 on their own tinted background).
const TONE: Record<BadgeTone, string> = {
  neutral: "border-line/50 bg-slate-100 text-muted",
  info: "border-civic/40 bg-civic/10 text-civic",
  success: "border-leaf/50 bg-leaf/10 text-leaf-strong",
  warning: "border-amber/60 bg-amber/20 text-amber-900",
  // For the deep green header band: a translucent amber fill with dark brown text blends into the green (about 1.3:1), so use solid amber with ink.
  warningOnDark: "border-amber bg-amber text-ink",
  teal: "border-teal/40 bg-teal/10 text-teal-strong",
  danger: "border-danger/40 bg-danger/10 text-danger",
};

/** Small pill. Pass an `icon` so meaning is never carried by colour alone. */
export default function Badge({ tone = "neutral", icon, children, className }: { tone?: BadgeTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", TONE[tone], className)}>
      {icon != null && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}
