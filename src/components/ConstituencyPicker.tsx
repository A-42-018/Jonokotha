"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveConstituency, type Area } from "@/lib/constituency";
import { api } from "@/lib/api-client";
import type { AreaMatch } from "@/lib/geo";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { MY_AREA_KEY, type MyArea } from "@/lib/areas-api";
import type { Lang } from "@/lib/i18n";
import type { LookupMatch } from "@/lib/mp-api";

const AreaChooser = dynamic(() => import("./AreaChooser"), { ssr: false });

type Labels = { open: string; choose: string; title: string; hint: string; sample: string; close: string; none: string; searchLabel: string; searchHint: string; noResults: string; error: string; searching: string; seat: string; vacant: string };

export default function ConstituencyPicker({ selected, signedIn, lang, labels }: { selected: Area; signedIn: boolean; lang: Lang; labels: Labels }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const autoOpened = useRef(false);
  const [opened, setOpened] = useState(false);
  const [, setMine] = useLocalValue<MyArea | null>(MY_AREA_KEY, null);
  const current = selected;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AreaMatch[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const name = (c: { nameBn: string; nameEn: string }) => (lang === "bn" ? c.nameBn : c.nameEn);

  // First sign-in: ask once if nothing has been chosen yet.
  useEffect(() => {
    if (signedIn && current.sample && !autoOpened.current) {
      autoOpened.current = true;
      dialog.current?.showModal();
      setOpened(true);
    }
  }, [signedIn, current]);

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

  return (
    <>
      <button
        type="button"
        onClick={() => { dialog.current?.showModal(); setOpened(true); }}
        aria-haspopup="dialog"
        // WCAG 2.5.3: the visible words (the area name, then the sample badge, with a space between them) are all inside the name.
        aria-label={`${labels.open}: ${name(current)}${current.sample ? ` ${labels.sample}` : ""}`}
        className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-white/50 bg-white/10 px-3 text-[0.9375rem] font-medium text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:max-w-72"
      >
        <span aria-hidden>📍</span>
        <span className="truncate">{name(current)}</span>
        {current.sample && <>{" "}<span className="shrink-0 rounded-full bg-amber px-2 text-[0.8125rem] font-semibold text-ink">{labels.sample}</span></>}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="cp-title"
        onClose={() => setOpened(false)}
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="space-y-3 p-5">
          <h2 id="cp-title" className="text-xl font-semibold text-civic">{labels.title}</h2>
          <p className="text-sm text-slate-600">{labels.hint}</p>
          <label htmlFor="cp-search" className="block text-sm font-medium">{labels.searchLabel}</label>
          <input
            id="cp-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" inputMode="search"
            aria-describedby="cp-hint" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-civic"
          />
          <p id="cp-hint" className="text-xs text-muted">{labels.searchHint}</p>
          <div aria-live="polite" className="text-sm text-slate-600">
            {searchable && state === "loading" && labels.searching}
            {searchable && state === "error" && labels.error}
            {searchable && state === "idle" && shown && shown.length === 0 && labels.noResults}
          </div>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {(shown ?? []).map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => choose(c.key)}
                  aria-pressed={c.key === current.id}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 px-3 py-2 text-left hover:bg-slate-50 aria-pressed:border-civic aria-pressed:bg-civic/10 focus-visible:outline-2 focus-visible:outline-civic"
                >
                  <span>{lang === "bn" ? c.name_bn : c.name_en}{c.seat_no ? <span className="ms-2 text-xs text-muted">{labels.seat} {c.seat_no}</span> : null}</span>
                  <span className="flex items-center gap-2">
                    {c.seat_status === "vacant" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{labels.vacant}</span>}
                    {c.is_demo && <span className="rounded-full bg-amber/20 px-2 py-0.5 text-xs text-amber-900">{labels.sample}</span>}
                    {c.key === current.id && <span aria-hidden>✓</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {opened && (
            <AreaChooser onConfirm={(m: LookupMatch) => {
              setMine({ key: m.constituency.key, name_bn: m.constituency.name_bn, name_en: m.constituency.name_en, sample: m.constituency.is_demo });
              dialog.current?.close();
            }} />
          )}
          <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 font-medium focus-visible:outline-2 focus-visible:outline-civic">
            {labels.close}
          </button>
        </div>
      </dialog>
    </>
  );
}
