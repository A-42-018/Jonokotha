"use client";
import { useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n";

const subscribe = () => () => {};

/**
 * Reads the page language set by the root layout (client components cannot read the lang cookie on the server).
 * Pass `override` to force a language, e.g. on the /dev/ui review page that shows bn and en side by side.
 */
export function useLang(override?: Lang): Lang {
  const page = useSyncExternalStore(subscribe, () => (document.documentElement.lang === "en" ? "en" : "bn"), () => "bn" as Lang);
  return override ?? page;
}
