"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { ExploreIssue } from "@/lib/explore";
import { useT } from "@/components/ui/useT";
import { CENTER, osmStyle, WORKER } from "@/lib/map";


type Props = { issues: ExploreIssue[]; onSelect: (ref: string) => void; origin?: { lat: number; lng: number } };

/** Clustered public map. Only approximate positions arrive here (see `approxCoord`). Loaded lazily from ExploreView. */
export default function ExploreMap({ issues, onSelect, origin }: Props) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const latest = useRef({ issues, onSelect });
  useEffect(() => { latest.current = { issues, onSelect }; });

  const geojson = (list: ExploreIssue[]) => ({
    type: "FeatureCollection" as const,
    features: list.filter((i) => i.lat !== undefined && i.lng !== undefined).map((i) => ({
      type: "Feature" as const, properties: { ref: i.ref }, geometry: { type: "Point" as const, coordinates: [i.lng!, i.lat!] },
    })),
  });

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        ml.setWorkerUrl(WORKER);
        map = new ml.Map({
          container: box.current,
          center: CENTER,
          zoom: 12.5,
          attributionControl: { compact: true },
          style: osmStyle(),
        });
        mapRef.current = map;
        map.on("error", () => { /* tile errors (offline) are not fatal: markers still show */ });
        map.on("load", () => {
          if (!map) return;
          map.addSource("issues", { type: "geojson", data: geojson(latest.current.issues), cluster: true, clusterRadius: 50, clusterMaxZoom: 14 });
          map.addLayer({ id: "clusters", type: "circle", source: "issues", filter: ["has", "point_count"], paint: { "circle-color": "#1d5fa8", "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 10, 30], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
          map.addLayer({ id: "cluster-count", type: "symbol", source: "issues", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 14, "text-font": ["Open Sans Regular"] }, paint: { "text-color": "#fff" } });
          map.addLayer({ id: "point", type: "circle", source: "issues", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#0b6b6d", "circle-radius": 9, "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
          map.on("click", "point", (e) => { const ref = e.features?.[0]?.properties?.ref; if (ref) latest.current.onSelect(String(ref)); });
          map.on("click", "clusters", (e) => { map?.easeTo({ center: e.lngLat, zoom: (map.getZoom() ?? 12) + 2 }); });
          for (const l of ["point", "clusters"]) { map.on("mouseenter", l, () => { map!.getCanvas().style.cursor = "pointer"; }); map.on("mouseleave", l, () => { map!.getCanvas().style.cursor = ""; }); }
          setState("ready");
        });
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => { cancelled = true; map?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const src = mapRef.current?.getSource("issues") as import("maplibre-gl").GeoJSONSource | undefined;
    src?.setData(geojson(issues));
  }, [issues]);

  useEffect(() => {
    if (origin) mapRef.current?.easeTo({ center: [origin.lng, origin.lat], zoom: 14 });
  }, [origin]);

  if (state === "failed") return <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-4">{t.exMapFailed}</p>;
  return (
    <div className="relative">
      <div ref={box} role="region" aria-label={t.exMapAria} className="h-80 w-full overflow-hidden rounded-2xl border border-line bg-slate-100 sm:h-[28rem]" />
      {state === "loading" && <p role="status" className="absolute inset-0 grid place-items-center text-muted">{t.exMapLoading}</p>}
    </div>
  );
}
