"use client";
import { useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n";

const subscribe = () => () => {};

/** Reads the page language set by the root layout (client components cannot read the lang cookie on the server). */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, () => (document.documentElement.lang === "en" ? "en" : "bn"), () => "bn");
}
