// Helpers shared by the simulated demo data. Everything here is plain code: nothing is read from or written to a database.
export type Lang = "bn" | "en";
/** A text in both languages. The page language picks one. */
export interface Bi { bn: string; en: string }
export const bi = (bn: string, en: string): Bi => ({ bn, en });
export const tx = (b: Bi, lang: Lang): string => b[lang];

const DAY = 86_400_000;
/** An ISO time `d` days (and `h` hours) before now, so example records always look recent. */
export const ago = (d: number, h = 0): string => new Date(Date.now() - d * DAY - h * 3_600_000).toISOString();
/** An ISO time `d` days from now. */
export const ahead = (d: number): string => new Date(Date.now() + d * DAY).toISOString();
/** A calendar day (YYYY-MM-DD), `d` days from today (negative = past). */
export const dayOf = (d: number): string => new Date(Date.now() + d * DAY).toISOString().slice(0, 10);

export const AREA_KEY = "demo-1";
