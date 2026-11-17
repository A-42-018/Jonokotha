"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx, focusRing } from "./cx";

export type TabItem = { id: string; label: string; panel: ReactNode; disabled?: boolean };

/** Accessible tabs: roving tabindex, Arrow/Home/End keys (Arrow direction follows RTL), panels linked by aria-controls. */
export default function Tabs({ tabs, label, value, defaultValue, onChange }: {
  tabs: TabItem[];
  /** Accessible name of the tab list. */
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
}) {
  const uid = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs.find((x) => !x.disabled)?.id ?? "");
  const current = value ?? inner;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: string) {
    setInner(id);
    onChange?.(id);
    refs.current[id]?.focus();
  }

  function onKey(e: KeyboardEvent) {
    const enabled = tabs.filter((x) => !x.disabled);
    const i = enabled.findIndex((x) => x.id === current);
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const next = rtl ? "ArrowLeft" : "ArrowRight";
    const prev = rtl ? "ArrowRight" : "ArrowLeft";
    let target: number | null = null;
    if (e.key === next) target = (i + 1) % enabled.length;
    else if (e.key === prev) target = (i - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = enabled.length - 1;
    if (target === null) return;
    e.preventDefault();
    select(enabled[target].id);
  }

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKey} className="flex overflow-x-auto border-b border-line">
        {tabs.map((x) => {
          const active = x.id === current;
          return (
            <button
              key={x.id}
              ref={(el) => { refs.current[x.id] = el; }}
              role="tab"
              type="button"
              id={`${uid}-tab-${x.id}`}
              aria-selected={active}
              aria-controls={`${uid}-panel-${x.id}`}
              tabIndex={active ? 0 : -1}
              disabled={x.disabled}
              onClick={() => select(x.id)}
              className={cx(
                "-mb-px min-h-11 shrink-0 border-b-4 px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50",
                active ? "border-civic text-civic" : "border-transparent text-muted hover:text-foreground",
                focusRing,
              )}
            >
              {x.label}
            </button>
          );
        })}
      </div>
      {tabs.map((x) => (
        <div key={x.id} role="tabpanel" id={`${uid}-panel-${x.id}`} aria-labelledby={`${uid}-tab-${x.id}`} hidden={x.id !== current} tabIndex={0} className={cx("pt-4", focusRing)}>
          {x.id === current && x.panel}
        </div>
      ))}
    </div>
  );
}
