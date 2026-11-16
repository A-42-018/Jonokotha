import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  document.documentElement.lang = "bn";
});

// jsdom lacks these; the report form calls them after step changes.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollIntoView = vi.fn();

// Client components read strings through <I18nProvider>; unit tests render without it, so register the real dictionaries.
import { registerFallbackDicts } from "@/components/ui/I18nProvider";
import { dict } from "@/lib/i18n";
registerFallbackDicts(dict as unknown as Parameters<typeof registerFallbackDicts>[0]);
