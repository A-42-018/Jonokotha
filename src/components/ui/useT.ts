"use client";
import { dict, type Lang } from "@/lib/i18n";
import { useLang } from "./useLang";

/** Dictionary for the current page language (or `lang` when forced). */
export function useT(lang?: Lang) {
  return dict[useLang(lang)];
}
