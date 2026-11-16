import { cx } from "./cx";

/**
 * Progress through a multi-step flow (e.g. the report wizard).
 * `current` is 0-based. `label` names the list; `stepOf` is the already-formatted "Step 2 of 5" text.
 */
export default function Stepper({ steps, current, label, stepOf }: { steps: string[]; current: number; label: string; stepOf: string }) {
  return (
    <nav aria-label={label} className="@container">
      <p className="mb-2 text-sm font-medium text-muted @lg:hidden">{stepOf}: <span className="text-foreground">{steps[current]}</span></p>
      <ol className="flex items-center gap-1">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} aria-current={active ? "step" : undefined} className={cx("flex items-center gap-1", i < steps.length - 1 && "flex-1")}>
              <span className={cx(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                done && "border-leaf-strong bg-leaf-strong text-white",
                active && "border-civic bg-civic text-white",
                !done && !active && "border-line bg-white text-muted",
              )}>
                <span aria-hidden>{done ? "✓" : i + 1}</span>
                <span className="sr-only">{s}{done ? " ✓" : ""}</span>
              </span>
              <span className={cx("hidden whitespace-nowrap text-sm @lg:inline", active ? "font-semibold text-civic" : "text-muted")}>{s}</span>
              {i < steps.length - 1 && <span aria-hidden className={cx("mx-1 h-0.5 min-w-3 flex-1 rounded", done ? "bg-leaf-strong" : "bg-slate-300")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
