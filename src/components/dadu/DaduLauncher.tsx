"use client";
import { usePathname } from "next/navigation";
import { useRef, useState, type ComponentType } from "react";

/** The panel (avatar, chat, voice) loads only when someone calls Dadu: a click costs a request, an untouched page costs almost nothing.
 * A plain `import()` in the click handler (not `next/dynamic`) so the loader runtime is not added to every page's first-load JavaScript (tests/e2e/perf.spec.ts). */
type PanelProps = { page: string; onClose: () => void };

/** Pages where a floating button would be in the way: typing flows, sign-in, and the staff and developer areas. */
const HIDDEN = ["/report", "/login", "/mfa", "/office", "/admin", "/dev"];

export default function DaduLauncher({ label, short }: { label: string; short: string }) {
  const path = usePathname() ?? "/";
  const [Panel, setPanel] = useState<ComponentType<PanelProps> | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  if (HIDDEN.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <>
      <button ref={btn} data-dadu-launcher type="button" aria-label={`${short}: ${label}`} aria-expanded={!!Panel} aria-haspopup="dialog" onClick={() => void import("./DaduPanel").then((m) => setPanel(() => m.default))}
        className="fixed bottom-[6.5rem] end-3 z-40 inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-white bg-civic px-4 text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic lg:bottom-6">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#C48A5E" /><path d="M3 11 Q12 1 21 11 Q12 6 3 11Z" fill="#F4F1EA" /><circle cx="8.5" cy="11" r="3" fill="none" stroke="#3A2B20" strokeWidth="1.2" /><circle cx="15.5" cy="11" r="3" fill="none" stroke="#3A2B20" strokeWidth="1.2" /><path d="M5 15 Q12 22 19 15 Q12 17 5 15Z" fill="#F4F1EA" /></svg>
        <span className="hidden sm:inline">{short}</span>
      </button>
      {Panel && <Panel page={path} onClose={() => { setPanel(null); btn.current?.focus(); }} />}
    </>
  );
}
