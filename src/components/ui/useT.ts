"use client";
import type { Lang } from "@/lib/i18n";
import { useDict } from "./I18nProvider";
import { useLang } from "./useLang";

/** Dictionary for the current page language (or `lang` when forced). */
export function useT(lang?: Lang) {
  return useDict(useLang(lang));
}
