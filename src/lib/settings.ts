export const NOTIF_PREFS_KEY = "jonokotha:notif-prefs:v1";
export const NOTIF_PREFS = { status: true, reply: true, area: false };

/** Everything this app keeps in localStorage under its own prefix. */
export const DEVICE_PREFIX = "jonokotha:";

/** Removes this app's device-local data. Returns how many entries were removed. Never touches other sites' keys. */
export function clearDeviceData(storage: Pick<Storage, "length" | "key" | "removeItem"> = localStorage): number {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(DEVICE_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => storage.removeItem(k));
  // Tell mounted useLocalValue hooks to re-read.
  if (typeof window !== "undefined") window.dispatchEvent(new Event("jk-local-change"));
  return keys.length;
}
