// Simulated demo mode. While the `jk_demo=1` cookie is set, the browser-side API client answers from code (src/lib/demo-sim.ts)
// instead of calling the server, so every feature can be tried with example data and nothing is read from or written to the database.
// The mode is per browser, never per account: it is a cookie the visitor sets on /demo and clears again with the banner button.

export const DEMO_COOKIE = "jk_demo";
const MAX_AGE = 60 * 60 * 8; // eight hours, then the browser forgets it

/** Browser only. True while demo mode is on. */
export const demoOnBrowser = (): boolean => typeof document !== "undefined" && /(?:^|;\s*)jk_demo=1(?:;|$)/.test(document.cookie);

export function setDemoCookie(on: boolean): void {
  document.cookie = on ? `${DEMO_COOKIE}=1; path=/; max-age=${MAX_AGE}; samesite=lax` : `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Example references start with this, so a simulated record can never be mistaken for a real case (real ones are JK-YYYY-NNNN). */
export const DEMO_REF_PREFIX = "JKD-";
export const isDemoRef = (ref: string): boolean => ref.startsWith(DEMO_REF_PREFIX);
