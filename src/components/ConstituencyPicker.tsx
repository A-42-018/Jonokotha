"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { saveConstituency, type Area } from "@/lib/constituency";
import { api } from "@/lib/api-client";
import type { AreaMatch } from "@/lib/geo";
import { fmtNum, type Lang } from "@/lib/i18n";
import Button from "@/components/ui/Button";
import { fill } from "@/components/ui/cx";

type Labels = { open: string; choose: string; title: string; hint: string; sample: string; close: string; none: string; searchLabel: string; searchHint: string; noResults: string; error: string; searching: string; seat: string; vacant: string; ls: { btn: string; busy: string; privacy: string; denied: string; unsupported: string; failed: string; outside: string; foundSeat: string; foundDistrict: string; or: string } };

export default function ConstituencyPicker({ selected, signedIn, lang, labels }: { selected: Area; signedIn: boolean; lang: Lang; labels: Labels }) {
  const router = useRouter();
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const autoOpened = useRef(false);
  const current = selected;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AreaMatch[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const name = (c: { nameBn: string; nameEn: string }) => (lang === "bn" ? c.nameBn : c.nameEn);

  // "Find my seat from my location": ask the browser once, send the point to the server for this one lookup, show the seat or the district's seats.
  type Located = { method: "boundary" | "district" | "none"; seat: AreaMatch | null; district: { name_bn: string; name_en: string } | null; seats: AreaMatch[] };
  const [loc, setLoc] = useState<"idle" | "busy" | "denied" | "unsupported" | "failed">("idle");
  const [located, setLocated] = useState<Located | null>(null);
  function locate() {
    setLocated(null);
    if (!("geolocation" in navigator)) { setLoc("unsupported"); return; }
    setLoc("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        api<Located>(`/constituencies/locate?${new URLSearchParams({ lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5) })}`)
          .then((r) => { setLocated(r.data); setLoc("idle"); })
          .catch(() => setLoc("failed"));
      },
      (e) => setLoc(e.code === e.PERMISSION_DENIED ? "denied" : "failed"),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }

  // First sign-in: ask once if nothing has been chosen yet. Not inside the office and admin workspaces: staff work there first, and the office tour
  // opens its own dialog on the same visit (two stacked modals hid the page behind them).
  const workspace = path === "/office" || path.startsWith("/office/") || path === "/admin" || path.startsWith("/admin/");
  useEffect(() => {
    if (signedIn && current.sample && !workspace && !autoOpened.current) {
      autoOpened.current = true;
      dialog.current?.showModal();
    }
  }, [signedIn, current, workspace]);

  const searchable = q.trim().length >= 2 || /^[0-9০-৯]$/.test(q.trim());
  const shown = searchable ? results : null;
  // Search the 300 seats as the person types (waits 250 ms after the last key; ignores slow answers that arrive late).
  useEffect(() => {
    if (!searchable) return;
    const term = q.trim();
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      setState("loading");
      api<AreaMatch[]>(`/constituencies/search?${new URLSearchParams({ q: term })}`, { signal: ctl.signal })
        .then((r) => { setResults(r.data); setState("idle"); })
        .catch((e) => { if (!ctl.signal.aborted) { setResults(null); setState("error"); void e; } });
    }, 250);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [q, searchable]);

  function choose(id: string) {
    saveConstituency(id);
    dialog.current?.close();
    router.refresh();
  }

  // A large tap target: seat name, then its number; filled green when it is the current seat.
  const seatRow = (c: AreaMatch) => (
    <li key={c.key}>
      <button
        type="button"
        onClick={() => choose(c.key)}
        aria-pressed={c.key === current.id}
        className="flex min-h-14 w-full items-center justify-between gap-2 rounded-xl bg-slate-100 px-3.5 py-2 text-start text-foreground transition-colors hover:bg-civic/10 aria-pressed:bg-civic aria-pressed:text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-civic"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{lang === "bn" ? c.name_bn : c.name_en}</span>
          {c.seat_no ? <span className="block text-[0.9375rem] opacity-80">{labels.seat} {fmtNum(c.seat_no, lang)}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {c.seat_status === "vacant" && <span className="rounded-full bg-white px-2 py-0.5 text-sm text-ink">{labels.vacant}</span>}
          {c.is_demo && <span className="rounded-full bg-amber px-2 py-0.5 text-sm font-semibold text-ink">{labels.sample}</span>}
          {c.key === current.id && <span aria-hidden className="text-lg">✓</span>}
        </span>
      </button>
    </li>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        // WCAG 2.5.3: the visible words (the area name, then the sample badge, with a space between them) are all inside the name.
        aria-label={`${labels.open}: ${name(current)}${current.sample ? ` ${labels.sample}` : ""}`}
        className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-white/50 bg-white/10 px-3 text-[0.9375rem] font-medium text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white max-sm:w-11 max-sm:justify-center max-sm:px-0 sm:max-w-72"
      >
        <span aria-hidden>📍</span>
        <span className="truncate max-sm:hidden">{name(current)}</span>
        {current.sample && <>{" "}<span className="shrink-0 rounded-full max-sm:hidden bg-amber px-2 text-[0.8125rem] font-semibold text-ink">{labels.sample}</span></>}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="cp-title"
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
        // Phones: a bottom sheet. From sm: a centred card.
        className="mx-auto mb-0 mt-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-0 text-foreground jk-lift backdrop:bg-black/50 sm:m-auto sm:max-h-[90dvh] sm:rounded-3xl"
      >
        <div className="space-y-5 p-5 sm:p-6">
          <span aria-hidden className="mx-auto -mt-1 block h-1.5 w-10 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 id="cp-title" className="jk-h2">{labels.title}</h2>
              <p className="text-ink-2">{labels.hint}</p>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label={labels.close}
              className="-me-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-civic"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <section className="space-y-2">
            <Button full size="lg" loading={loc === "busy"} onClick={locate} icon={<span aria-hidden>📍</span>}>{loc === "busy" ? labels.ls.busy : labels.ls.btn}</Button>
            <p className="flex items-start gap-1.5 text-[0.9375rem] text-ink-2">
              <svg aria-hidden viewBox="0 0 24 24" className="mt-1 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              {labels.ls.privacy}
            </p>
            <div aria-live="polite" className="space-y-2">
              {loc === "denied" && <p className="rounded-xl bg-amber/15 p-3">{labels.ls.denied}</p>}
              {loc === "unsupported" && <p className="rounded-xl bg-amber/15 p-3">{labels.ls.unsupported}</p>}
              {loc === "failed" && <p className="rounded-xl bg-amber/15 p-3">{labels.ls.failed}</p>}
              {located?.method === "none" && <p className="rounded-xl bg-amber/15 p-3">{labels.ls.outside}</p>}
              {located?.method === "boundary" && located.seat && (
                <>
                  <p className="font-semibold">{labels.ls.foundSeat}</p>
                  <ul>{seatRow(located.seat)}</ul>
                </>
              )}
              {located?.method === "district" && located.district && (
                <>
                  <p className="font-semibold">{fill(labels.ls.foundDistrict, { district: lang === "bn" ? located.district.name_bn : located.district.name_en })}</p>
                  <ul className="grid max-h-[40dvh] grid-cols-2 gap-2 overflow-y-auto">{located.seats.map(seatRow)}</ul>
                </>
              )}
            </div>
          </section>

          <div aria-hidden className="flex items-center gap-3 text-[0.9375rem] text-muted">
            <span className="h-px flex-1 bg-slate-200" />{labels.ls.or}<span className="h-px flex-1 bg-slate-200" />
          </div>

          <section className="space-y-2">
            <label htmlFor="cp-search" className="block font-semibold">{labels.searchLabel}</label>
            <input
              id="cp-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" inputMode="search"
              aria-describedby="cp-hint" className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-civic"
            />
            <p id="cp-hint" className="text-[0.9375rem] text-muted">{labels.searchHint}</p>
            <div aria-live="polite" className="text-ink-2">
              {searchable && state === "loading" && labels.searching}
              {searchable && state === "error" && labels.error}
              {searchable && state === "idle" && shown && shown.length === 0 && labels.noResults}
            </div>
            {(shown ?? []).length > 0 && <ul className="grid max-h-[40dvh] gap-2 overflow-y-auto sm:grid-cols-2">{(shown ?? []).map(seatRow)}</ul>}
          </section>
        </div>
      </dialog>
    </>
  );
}
