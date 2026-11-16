import type { Category } from "./types";
import { matchesQuery } from "./translit";

/** Idea workflow (§7.7), collapsed to the labels citizens see. Upvotes are not approval or feasibility. */
export const IDEA_STATUSES = ["submitted", "moderation", "office_review", "needs_info", "under_consideration", "planned", "not_planned", "in_progress", "implemented"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export const UNDER_REVIEW: IdeaStatus[] = ["moderation", "office_review", "needs_info", "under_consideration"];

export interface Idea {
  id: string;
  title: string;
  summary: string;
  category: Category;
  area: string;
  supports: number;
  status: IdeaStatus;
  createdAt: string;
  /** Public reason for a rejected or deferred idea (§7.7). */
  reason?: string;
  sample?: boolean;
}

export type IdeaTab = "popular" | "newest" | "review";

export function ideasFor(list: Idea[], tab: IdeaTab, q: string, category: Category | "all", label: (c: Category) => string): Idea[] {
  const n = q.trim().toLowerCase();
  const base = list.filter((i) => (category === "all" || i.category === category) && (!n || matchesQuery(`${i.title} ${i.summary} ${i.area} ${label(i.category)}`, n)));
  if (tab === "review") return base.filter((i) => UNDER_REVIEW.includes(i.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (tab === "newest") return [...base].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [...base].sort((a, b) => b.supports - a.supports);
}

const words = (s: string) => new Set((s.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).filter((w) => w.length > 2));

/** Ideas that look like the draft (shared words, Dice coefficient), so people support instead of duplicating. */
export function similarIdeas(draft: string, list: Idea[], limit = 3, min = 0.25): Idea[] {
  const d = words(draft);
  if (d.size < 2) return [];
  return list
    .map((i) => {
      const w = words(`${i.title} ${i.summary}`);
      let hit = 0;
      d.forEach((x) => w.has(x) && hit++);
      return { i, score: (2 * hit) / (d.size + w.size) };
    })
    .filter((x) => x.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.i);
}

/** Support count shown: the base count plus this device's own support (one per idea). */
export const shownSupports = (idea: Idea, mine: boolean) => idea.supports + (mine ? 1 : 0);
