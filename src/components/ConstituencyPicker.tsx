"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CONSTITUENCIES, findConstituency, saveConstituency } from "@/lib/constituency";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { MY_AREA_KEY, type MyArea } from "@/lib/areas-api";
import type { Lang } from "@/lib/i18n";
import type { LookupMatch } from "@/lib/mp-api";

const AreaChooser = dynamic(() => import("./AreaChooser"), { ssr: false });

type Labels = { open: string; choose: string; title: string; hint: string; sample: string; close: string; none: string };

export default function ConstituencyPicker({ selectedId, signedIn, lang, labels }: { selectedId: string | null; signedIn: boolean; lang: Lang; labels: Labels }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const autoOpened = useRef(false);
  const [opened, setOpened] = useState(false);
  const [, setMine] = useLocalValue<MyArea | null>(MY_AREA_KEY, null);
  const current = findConstituency(selectedId);
  const name = (c: { nameBn: string; nameEn: string }) => (lang === "bn" ? c.nameBn : c.nameEn);

  // First sign-in: ask once if nothing has been chosen yet.
  useEffect(() => {
    if (signedIn && !current && !autoOpened.current) {
      autoOpened.current = true;
      dialog.current?.showModal();
      setOpened(true);
    }
  }, [signedIn, current]);

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
        aria-label={current ? `${labels.open}: ${name(current)}` : `${labels.choose}: ${labels.none}`}
        className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic sm:max-w-64"
      >
        <span aria-hidden>📍</span>
        <span className="truncate">{current ? name(current) : labels.choose}</span>
        {current?.sample && <span className="shrink-0 rounded-full bg-amber/20 px-1.5 text-xs text-amber-900">{labels.sample}</span>}
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
          <ul className="space-y-2">
            {CONSTITUENCIES.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c.id)}
                  aria-pressed={c.id === current?.id}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 px-3 py-2 text-left hover:bg-slate-50 aria-pressed:border-civic aria-pressed:bg-civic/10 focus-visible:outline-2 focus-visible:outline-civic"
                >
                  <span>{name(c)}</span>
                  <span className="flex items-center gap-2">
                    {c.sample && <span className="rounded-full bg-amber/20 px-2 py-0.5 text-xs text-amber-900">{labels.sample}</span>}
                    {c.id === current?.id && <span aria-hidden>✓</span>}
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
