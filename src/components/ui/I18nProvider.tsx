"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";

type Dicts = Partial<Record<Lang, Dict>>;
const Ctx = createContext<Dicts>({});

/** Tests register the real dictionaries here, so components render without a provider (see tests/unit/setup.ts). */
let fallback: Dicts = {};
export function registerFallbackDicts(d: Dicts) { fallback = d; }

/**
 * Hands the active language's strings to client components. The server layout passes only that language, so the
 * browser never downloads the other one (about 15 KB gzip) as JavaScript. Nested providers add languages
 * (used by /dev/ui, which shows bn and en side by side).
 */
export default function I18nProvider({ dicts, children }: { dicts: Dicts; children: ReactNode }) {
  const parent = useContext(Ctx);
  return <Ctx.Provider value={{ ...parent, ...dicts }}>{children}</Ctx.Provider>;
}

export function useDict(lang: Lang): Dict {
  const ctx = useContext(Ctx);
  const d = ctx[lang] ?? fallback[lang];
  if (!d) throw new Error(`No ${lang} strings: wrap the page in <I18nProvider>`);
  return d;
}
