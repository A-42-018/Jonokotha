import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError, fromDbError } from "./api";

/** Bangladesh bounding box: rejects swapped, zero or foreign coordinates before they reach the database. */
export const inBangladesh = (lat: number, lng: number) => lat >= 20.5 && lat <= 26.8 && lng >= 88.0 && lng <= 92.8;
export const Lat = z.number().finite().min(20.5, "outside Bangladesh").max(26.8, "outside Bangladesh");
export const Lng = z.number().finite().min(88.0, "outside Bangladesh").max(92.8, "outside Bangladesh");

export const LocationInput = z.object({
  lat: Lat.optional(), lng: Lng.optional(),
  locationSource: z.enum(["device", "map", "manual_area"]).optional(),
  locationAccuracyM: z.number().int().min(0).max(100_000).optional(),
});

export interface AreaMatch { key: string; name_bn: string; name_en: string; district: string | null; is_demo: boolean; method?: string }

export async function lookupByPoint(sb: SupabaseClient, lat: number, lng: number): Promise<AreaMatch[]> {
  const { data, error } = await sb.rpc("lookup_constituency", { p_lat: lat, p_lng: lng });
  if (error) throw fromDbError(error);
  return (data ?? []) as AreaMatch[];
}

export async function searchAreas(sb: SupabaseClient, q: string): Promise<AreaMatch[]> {
  const { data, error } = await sb.rpc("search_constituencies", { p_q: q });
  if (error) throw fromDbError(error);
  return (data ?? []) as AreaMatch[];
}

/** Parses "lat,lng" (query string form); throws 422 on anything else. */
export function parsePoint(s: string, field = "near"): { lat: number; lng: number } {
  const m = /^(-?\d{1,3}(?:\.\d{1,8})?),(-?\d{1,3}(?:\.\d{1,8})?)$/.exec(s);
  const lat = m ? Number(m[1]) : NaN, lng = m ? Number(m[2]) : NaN;
  if (!m || !inBangladesh(lat, lng)) throw new ApiError("validation_failed", "Use lat,lng inside Bangladesh.", { [field]: "invalid" });
  return { lat, lng };
}

/** Validates a GeoJSON Polygon/MultiPolygon (closed rings, positions inside Bangladesh) and returns its bounding box. */
export function boundaryBBox(g: unknown): { min_lat: number; max_lat: number; min_lng: number; max_lng: number } {
  const bad = (m: string) => new ApiError("validation_failed", m, { boundary: "invalid" });
  const geo = g as { type?: string; coordinates?: unknown };
  const polys = geo?.type === "Polygon" ? [geo.coordinates] : geo?.type === "MultiPolygon" ? (geo.coordinates as unknown[]) : null;
  if (!polys || !Array.isArray(polys) || !polys.length) throw bad("boundary must be a Polygon or MultiPolygon");
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180, points = 0;
  for (const poly of polys) {
    if (!Array.isArray(poly) || !poly.length) throw bad("empty polygon");
    for (const ring of poly as unknown[]) {
      if (!Array.isArray(ring) || ring.length < 4) throw bad("a ring needs at least 4 positions");
      const first = ring[0] as number[], last = ring[ring.length - 1] as number[];
      if (first[0] !== last[0] || first[1] !== last[1]) throw bad("rings must be closed");
      for (const p of ring as number[][]) {
        if (!Array.isArray(p) || typeof p[0] !== "number" || typeof p[1] !== "number" || !inBangladesh(p[1], p[0])) throw bad("a position is outside Bangladesh or malformed (use [lng, lat])");
        minLat = Math.min(minLat, p[1]); maxLat = Math.max(maxLat, p[1]); minLng = Math.min(minLng, p[0]); maxLng = Math.max(maxLng, p[0]); points++;
      }
    }
  }
  if (points > 200_000) throw bad("boundary is too detailed");
  return { min_lat: minLat, max_lat: maxLat, min_lng: minLng, max_lng: maxLng };
}
