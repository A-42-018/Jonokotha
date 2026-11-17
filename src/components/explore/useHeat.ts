"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchHeatmap } from "@/lib/heatmap-api";

/** Density cells for the chosen area and topic (B7.11). A 404 comes back as "planned" (no switch shown); any other failure is an error the map page says so. */
export function useHeat(constituency: string, category: string) {
  return useQuery({ queryKey: ["heatmap", constituency, category], queryFn: () => fetchHeatmap(constituency, 30, category), retry: false, staleTime: 300_000 });
}
