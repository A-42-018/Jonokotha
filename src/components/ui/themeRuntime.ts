import { cleanTheme, DEFAULT_THEME, resolveTheme, THEME_KEY } from "@/lib/theme";

/**
 * Applies the saved page-colour choice to <html> (`data-theme="dark"`). Loaded only by a build that has the dark-mode flag on (see ThemeApplier),
 * so a build without it carries none of this code. Follows the choice when Settings changes it (the shared "jk-local-change" event), another tab
 * changes it (the "storage" event) and, for "follow the phone", when the phone changes.
 */
export function start(): () => void {
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  const apply = () => {
    let saved: unknown = DEFAULT_THEME;
    try { const raw = localStorage.getItem(THEME_KEY); if (raw !== null) saved = JSON.parse(raw); } catch { /* blocked or damaged: follow the phone */ }
    const t = resolveTheme(cleanTheme(saved), mq?.matches ?? false);
    if (t === "dark") document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
  };
  apply();
  window.addEventListener("jk-local-change", apply);
  window.addEventListener("storage", apply);
  mq?.addEventListener?.("change", apply);
  return () => { window.removeEventListener("jk-local-change", apply); window.removeEventListener("storage", apply); mq?.removeEventListener?.("change", apply); };
}
