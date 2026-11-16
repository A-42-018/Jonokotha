"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum } from "@/lib/format";
import { countryName } from "@/lib/country";
import { inCountry, searchPlaces, type Pin } from "@/lib/places";

const PinMap = dynamic(() => import("./PinMap"), { ssr: false });

/**
 * Location helpers for the report wizard: area search, "use my location" (only on click, explicit permission),
 * tap-to-place pin. The area text field below stays the required, always-available fallback.
 */
export default function LocationPicker({ pin, onPin, onArea }: { pin?: Pin; onPin: (p?: Pin) => void; onArea: (name: string) => void }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState<Pin>();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const results = searchPlaces(q, lang);

  function place(p: Pin) {
    if (!inCountry(p)) { setMsg(t.lpOutside.replace("{country}", countryName(lang))); return; }
    setMsg("");
    onPin(p);
  }

  function locate() {
    if (!navigator.geolocation) { setMsg(t.lpUnavailable); return; }
    setBusy(true);
    setMsg("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); const c = { lat: p.coords.latitude, lng: p.coords.longitude }; setOpen(true); setFocus(c); place(c); },
      () => { setBusy(false); setMsg(t.lpDenied); },
      { timeout: 10_000, enableHighAccuracy: true },
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t.lpNote}</p>
      <Input label={t.lpSearch} type="search" hint={t.lpSearchHint} value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() && (
        <div aria-live="polite">
          {results.length === 0 ? (
            <p className="text-sm text-muted">{t.lpNoPlace}</p>
          ) : (
            <>
              <p className="sr-only">{fillNum(t.lpResults, { n: results.length }, lang)}</p>
              <ul className="flex flex-wrap gap-2">
                {results.map((p) => (
                  <li key={p.id}>
                    <Button variant="secondary" onClick={() => { onArea(p[lang]); setFocus({ lat: p.lat, lng: p.lng }); setOpen(true); setQ(""); }}>{p[lang]}</Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={busy} onClick={locate}>{busy ? t.lpLocating : t.lpUseLocation}</Button>
        <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t.lpHideMap : t.lpShowMap}</Button>
      </div>
      {msg && <p role="status" className="text-sm text-danger">{msg}</p>}
      {open && (
        <div className="space-y-2">
          <PinMap pin={pin} focus={focus} onPick={place} />
          <p className="text-sm text-muted">{t.lpPinHint} {t.exMapCredit}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3" aria-live="polite">
        <span className="text-sm font-medium">{pin ? t.lpPinPlaced : t.lpPinNone}</span>
        {pin && <Button variant="ghost" onClick={() => onPin(undefined)}>{t.lpPinClear}</Button>}
      </div>
    </div>
  );
}
