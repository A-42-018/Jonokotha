"use client";
import { useEffect, useState } from "react";
import { dict } from "@/lib/i18n";
import { useLang } from "./useLang";

/** Sticky banner shown while the browser is offline; briefly confirms when back online. */
export default function OfflineBanner() {
  const t = dict[useLang()];
  const [state, setState] = useState<"online" | "offline" | "back">("online");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const off = () => { clearTimeout(timer); setState("offline"); };
    const on = () => { setState("back"); timer = setTimeout(() => setState("online"), 3000); };
    if (!navigator.onLine) off();
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => { clearTimeout(timer); window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, []);
  if (state === "online") return null;
  const offline = state === "offline";
  return (
    <div role="status" aria-live="polite" className={`sticky top-0 z-50 flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium ${offline ? "bg-amber text-slate-900" : "bg-leaf text-white"}`}>
      <span aria-hidden>{offline ? "⚠" : "✓"}</span>
      {offline ? t.stOfflineBanner : t.stBackOnline}
    </div>
  );
}
