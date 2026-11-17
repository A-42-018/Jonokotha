/** Dark mode (F7.10, masterplan 7.2). A device-local choice: follow the phone, always light, or always dark. */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = "jonokotha:theme:v1";
export const DEFAULT_THEME: Theme = "system";
export const cleanTheme = (v: unknown): Theme => ((THEMES as readonly unknown[]).includes(v) ? (v as Theme) : DEFAULT_THEME);

/** The theme to draw: "system" follows the OS setting. */
export function resolveTheme(pref: Theme, systemDark: boolean): "light" | "dark" {
  return pref === "dark" || (pref === "system" && systemDark) ? "dark" : "light";
}
