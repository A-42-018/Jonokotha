"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";

type Dicts = Partial<Record<Lang, Dict>>;
type Value = { lang: Lang; dicts: Dicts };
const Ctx = createContext<Value>({ lang: "bn", dicts: {} });

/** Tests register the real dictionaries here, so components render without a provider (see tests/unit/setup.ts). */
let fallback: Dicts = {};
export function registerFallbackDicts(d: Dicts) { fallback = d; }

/**
 * Hands the page language and its strings to client components. The server layout passes only that language, so
 * the browser never downloads the other one (about 15 KB gzip) as JavaScript. Nested providers add languages
 * (used by /dev/ui, which shows bn and en side by side).
 */
export default function I18nProvider({ lang, dicts, children }: { lang?: Lang; dicts: Dicts; children: ReactNode }) {
  const parent = useContext(Ctx);
  return <Ctx.Provider value={{ lang: lang ?? parent.lang, dicts: { ...parent.dicts, ...dicts } }}>{children}</Ctx.Provider>;
}

/** Page language as the server rendered it: what server rendering and hydration use before the browser can be asked. */
export function usePageLang(): Lang {
  return useContext(Ctx).lang;
}

export function useDict(lang: Lang): Dict {
  const d = useContext(Ctx).dicts[lang] ?? fallback[lang];
  if (!d) throw new Error(`No ${lang} strings: wrap the page in <I18nProvider>`);
  return d;
}
