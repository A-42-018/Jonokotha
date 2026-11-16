import type { Category } from "./types";

/** What this person follows. Device-local until the API stores it (see docs/frontend.md). */
export interface Follows { issues: string[]; areas: string[]; categories: Category[]; meToo: string[] }
export const FOLLOWS_KEY = "jonokotha:follows:v1";
export const NO_FOLLOWS: Follows = { issues: [], areas: [], categories: [], meToo: [] };

export type FollowKind = keyof Follows;

/** Adds the id if absent, removes it if present. Never mutates. */
export function toggleFollow<K extends FollowKind>(f: Follows, kind: K, id: Follows[K][number]): Follows {
  const list = f[kind] as string[];
  const next = list.includes(id as string) ? list.filter((x) => x !== id) : [...list, id as string];
  return { ...f, [kind]: next };
}

export const isFollowing = (f: Follows, kind: FollowKind, id: string) => (f[kind] as string[]).includes(id);

/** Resolution feedback (§7.5): 1–5 rating after resolution, then reopen or appeal when not fixed. */
export interface Feedback { rating?: number; reopen?: string; appeal?: string; at: string }
export const FEEDBACK_KEY = "jonokotha:feedback:v1";
export const NO_FEEDBACK: Record<string, Feedback> = {};
export const isRating = (n: unknown): n is 1 | 2 | 3 | 4 | 5 => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;
