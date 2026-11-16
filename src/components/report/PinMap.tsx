"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/ui/useT";
import { CENTER, osmStyle, WORKER } from "@/lib/map";
import type { Pin } from "@/lib/places";

/** Tap-to-place pin map (lazy loaded by LocationPicker). `focus` recentres the map; `pin` is controlled. */
export default function PinMap({ pin, focus, onPick }: { pin?: Pin; focus?: Pin; onPick: (p: Pin) => void }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const pick = useRef(onPick);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { pick.current = onPick; });

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        ml.setWorkerUrl(WORKER);
        mlRef.current = ml;
        map = new ml.Map({ container: box.current, style: osmStyle(), center: CENTER, zoom: 13, attributionControl: { compact: true } });
        map.on("error", () => { /* offline tiles are not fatal */ });
        map.on("click", (e) => pick.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
        map.on("load", () => setReady(true));
        mapRef.current = map;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; map?.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  useEffect(() => {
    const ml = mlRef.current, map = mapRef.current;
    if (!ready || !ml || !map) return;
    if (!pin) { markerRef.current?.remove(); markerRef.current = null; return; }
    if (!markerRef.current) markerRef.current = new ml.Marker({ color: "#b42318" }).setLngLat([pin.lng, pin.lat]).addTo(map);
    else markerRef.current.setLngLat([pin.lng, pin.lat]);
  }, [pin, ready]);

  useEffect(() => {
    if (focus && ready) mapRef.current?.easeTo({ center: [focus.lng, focus.lat], zoom: 15 });
  }, [focus, ready]);

  if (failed) return <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.exMapFailed}</p>;
  return <div ref={box} role="region" aria-label={t.lpMapAria} className="h-72 w-full overflow-hidden rounded-2xl border border-line bg-slate-100" />;
}
