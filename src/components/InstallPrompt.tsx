"use client";
import { useEffect, useState } from "react";
import { useT } from "./ui/useT";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const KEY = "jk-install-dismissed";

function isDismissed() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** Dismissible install banner driven by `beforeinstallprompt`. Hidden once installed or dismissed. */
export default function InstallPrompt() {
  const t = useT();
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isDismissed() || window.matchMedia("(display-mode: standalone)").matches) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  // Shown only after the person has used the page (first tap, key or scroll): the banner never competes with the content
  // on first paint, and it is not offered to someone who is only glancing.
  useEffect(() => {
    if (!evt || touched) return;
    const go = () => setTouched(true);
    const opts = { once: true, passive: true } as const;
    for (const ev of ["pointerdown", "keydown", "scroll"] as const) window.addEventListener(ev, go, opts);
    return () => { for (const ev of ["pointerdown", "keydown", "scroll"] as const) window.removeEventListener(ev, go); };
  }, [evt, touched]);

  if (!evt || !touched) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* storage blocked: hide for this visit only */ }
    setEvt(null);
  };
  const install = async () => {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "dismissed") dismiss(); else setEvt(null);
  };

  return (
    <section
      aria-labelledby="install-title"
      className="fixed inset-x-3 bottom-[5.5rem] z-40 mx-auto lg:bottom-3 max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <h2 id="install-title" className="font-semibold text-slate-900">{t.installTitle}</h2>
      <p className="mt-1 text-sm text-slate-700">{t.installBody}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={install} className="min-h-11 flex-1 rounded-xl bg-civic px-4 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">
          {t.installAction}
        </button>
        <button type="button" onClick={dismiss} className="min-h-11 min-w-11 rounded-xl border border-slate-300 px-4 font-medium text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">
          {t.installDismiss}
        </button>
      </div>
    </section>
  );
}
