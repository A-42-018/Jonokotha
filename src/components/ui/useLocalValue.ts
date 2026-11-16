"use client";
import { useCallback, useSyncExternalStore } from "react";

const EVENT = "jk-local-change";
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, initial: T): T {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* storage blocked */ }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: unknown = initial;
  if (raw !== null) { try { value = JSON.parse(raw); } catch { value = initial; } }
  cache.set(key, { raw, value });
  return value as T;
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
};

/**
 * A value kept in localStorage, shared across components and tabs, SSR-safe (server and first paint use `initial`).
 * Used for client-only stubs (support, follow, drafts) until the backend endpoints exist.
 * `initial` must be a stable reference (module constant).
 */
export function useLocalValue<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key, initial), () => initial);
  const set = useCallback((next: T | ((prev: T) => T)) => {
    const prev = read(key, initial);
    const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT));
  }, [key, initial]);
  return [value, set];
}
