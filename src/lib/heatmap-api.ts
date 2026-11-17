import { api } from "@/lib/api-client";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";

/** Heatmaps and clusters (B7.11). Cells are square, only cells with 5 or more public issues are returned, and `cells_hidden` counts the rest. Never a ranking of areas. */
export interface HeatCell { lat: number; lng: number; count: number; top_category: string | null; previous_period_count: number | null; emerging: boolean }
export interface Heatmap { cells: HeatCell[]; cells_hidden: number; min_group_size: number; cell_size_m: number; period_days: number; category: string | null; generated_at: string; definition: string; is_sample?: boolean; category_clusters?: { category: string; count: number }[] }

export const fetchHeatmap = (constituency: string, days = 30, category?: string): Promise<OrPlanned<Heatmap>> =>
  readOrPlanned<Heatmap>(`/analytics/heatmap?${new URLSearchParams({ constituency, days: String(days), cell_m: "1000", ...(category && category !== "all" ? { category } : {}) })}`);
export const fetchClusters = (constituency: string, days = 30, cell = 250) => api<Heatmap>(`/office/analytics/clusters?${new URLSearchParams({ constituency, days: String(days), cell_m: String(cell) })}`).then((r) => r.data);

/** GeoJSON points for the map's heat layer; the weight is the cell's count. Cells that are not a finite position are dropped. */
export function heatGeoJson(cells: readonly HeatCell[]) {
  return {
    type: "FeatureCollection" as const,
    features: cells.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && c.count >= 1).map((c) => ({
      type: "Feature" as const, properties: { count: c.count, emerging: c.emerging }, geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
    })),
  };
}
export const emergingCount = (cells: readonly HeatCell[]) => cells.filter((c) => c.emerging).length;
