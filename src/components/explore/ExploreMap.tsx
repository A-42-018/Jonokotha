"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { ExploreIssue } from "@/lib/explore";
import { useT } from "@/components/ui/useT";
import { heatGeoJson, type HeatCell } from "@/lib/heatmap-api";
import { CENTER, mapAnimate, osmStyle, WORKER } from "@/lib/map";


type Props = { issues: ExploreIssue[]; onSelect: (ref: string) => void; origin?: { lat: number; lng: number }; heat?: HeatCell[] };

/** Clustered public map. Only approximate positions arrive here (see `approxCoord`). Loaded lazily from ExploreView. */
export default function ExploreMap({ issues, onSelect, origin, heat }: Props) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const latest = useRef({ issues, onSelect, heat });
  useEffect(() => { latest.current = { issues, onSelect, heat }; });

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
          // Density layer from the server's cells (only cells with 5 or more public issues). Drawn under the clusters; shown only when the person switches it on.
          map.addSource("heat", { type: "geojson", data: heatGeoJson(latest.current.heat ?? []) });
          map.addLayer({ id: "heat", type: "heatmap", source: "heat", layout: { visibility: latest.current.heat ? "visible" : "none" }, paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "count"], 5, 0.35, 40, 1], "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 30, 15, 70], "heatmap-opacity": 0.75,
            "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(29,95,168,0)", 0.25, "rgba(111,168,220,0.55)", 0.5, "#f2a33a", 0.8, "#d9531e", 1, "#8a1c1c"],
          } });
          map.addSource("issues", { type: "geojson", data: geojson(latest.current.issues), cluster: true, clusterRadius: 60, clusterMaxZoom: 15 });
          // Cluster size and colour grow with the count in three steps; the colours keep 4.5:1 against the white count.
          map.addLayer({ id: "clusters", type: "circle", source: "issues", filter: ["has", "point_count"], paint: { "circle-color": ["step", ["get", "point_count"], "#1d5fa8", 10, "#0b6b6d", 50, "#8a4b00"], "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 10, 30, 50, 38], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
          map.addLayer({ id: "cluster-count", type: "symbol", source: "issues", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 14, "text-font": ["Open Sans Regular"] }, paint: { "text-color": "#fff" } });
          map.addLayer({ id: "point", type: "circle", source: "issues", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#0b6b6d", "circle-radius": 9, "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
          map.on("click", "point", (e) => { const ref = e.features?.[0]?.properties?.ref; if (ref) latest.current.onSelect(String(ref)); });
          map.on("click", "clusters", async (e) => {
            // Zoom to the level where this cluster breaks apart, not a fixed jump.
            const src = map?.getSource("issues") as import("maplibre-gl").GeoJSONSource | undefined;
            const id = e.features?.[0]?.properties?.cluster_id;
            let zoom = (map?.getZoom() ?? 12) + 2;
            try { if (src && id !== undefined) zoom = await src.getClusterExpansionZoom(Number(id)); } catch { /* keep the fixed step */ }
            map?.easeTo({ center: e.lngLat, zoom, animate: mapAnimate() });
          });
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
    const m = mapRef.current;
    if (!m || !m.getSource("heat")) return;
    (m.getSource("heat") as import("maplibre-gl").GeoJSONSource).setData(heatGeoJson(heat ?? []));
    m.setLayoutProperty("heat", "visibility", heat ? "visible" : "none");
  }, [heat, state]);

  useEffect(() => {
    if (origin) mapRef.current?.easeTo({ center: [origin.lng, origin.lat], zoom: 14, animate: mapAnimate() });
  }, [origin]);

  if (state === "failed") return <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-4">{t.exMapFailed}</p>;
  return (
    <div className="relative">
      <div ref={box} role="region" aria-label={t.exMapAria} className="h-80 w-full overflow-hidden rounded-2xl border border-line bg-slate-100 sm:h-[28rem]" />
      {state === "loading" && <p role="status" className="absolute inset-0 grid place-items-center text-muted">{t.exMapLoading}</p>}
    </div>
  );
}
