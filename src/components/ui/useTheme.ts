"use client";
import { cleanTheme, DEFAULT_THEME, THEME_KEY, type Theme } from "@/lib/theme";
import { useLocalValue } from "./useLocalValue";

/** The saved page-colour choice, for the Settings control. */
export function useTheme(): [Theme, (next: Theme) => void] {
  const [raw, set] = useLocalValue<Theme>(THEME_KEY, DEFAULT_THEME);
  return [cleanTheme(raw), set];
}
