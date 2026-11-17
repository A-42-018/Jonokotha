"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { cx, focusRing } from "./cx";
import { useT } from "./useT";

export type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; message: string };

const TONE: Record<ToastTone, { cls: string; icon: string }> = {
  success: { cls: "bg-leaf-strong", icon: "✓" },
  error: { cls: "bg-danger", icon: "⚠" },
  info: { cls: "bg-civic", icon: "ℹ" },
};

const Ctx = createContext<(tone: ToastTone, message: string) => void>(() => {});

/** `const toast = useToast(); toast("success", t.saved)`. A no-op outside <ToastProvider>. */
export function useToast() {
  return useContext(Ctx);
}

let seq = 0;

/** Renders one toast at a time in a polite live region (assertive for errors). Auto-dismisses after 5s. */
export function ToastProvider({ children, lang }: { children: ReactNode; lang?: Lang }) {
  const t = useT(lang);
  const [item, setItem] = useState<ToastItem | null>(null);
  const push = useCallback((tone: ToastTone, message: string) => setItem({ id: ++seq, tone, message }), []);
  const value = useMemo(() => push, [push]);

  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(() => setItem(null), 5000);
    return () => clearTimeout(timer);
  }, [item]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 xl:bottom-4 flex justify-center">
        {item && <ToastView key={item.id} tone={item.tone} message={item.message} closeLabel={t.uiDismiss} onClose={() => setItem(null)} />}
      </div>
    </Ctx.Provider>
  );
}

/** The toast surface itself, also used statically on /dev/ui. */
export function ToastView({ tone, message, closeLabel, onClose }: { tone: ToastTone; message: string; closeLabel: string; onClose?: () => void }) {
  const s = TONE[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("pointer-events-auto flex max-w-md items-center gap-3 rounded-xl py-1 ps-4 pe-1 text-sm font-medium text-white shadow-lg", s.cls)}>
      <span aria-hidden>{s.icon}</span>
      <span className="py-2">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label={closeLabel} className={cx("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg", focusRing)}>
          <span aria-hidden>✕</span>
        </button>
      )}
    </div>
  );
}
