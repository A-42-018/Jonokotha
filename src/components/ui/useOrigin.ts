"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
/** window.location.origin on the client, "" during server render (so links are filled after hydration). */
export function useOrigin(): string {
  return useSyncExternalStore(subscribe, () => window.location.origin, () => "");
}
