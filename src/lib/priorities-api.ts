import { api } from "@/lib/api-client";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";

/** Community priority ranking (B7.8): non-binding, one ranking per verified local account, aggregate only. Contract: docs/api-v1.md "Surveys, satisfaction, commitments, priorities" (branch claude/backend-phase7). */
export interface Round { ref: string; constituency_key: string; title: string; description: string | null; status: "open" | "closed"; closes_at: string | null; opened_at: string | null; closed_at: string | null; label: "non_binding"; is_sample?: boolean }
export interface RoundItem { id: string; position: number; label: string }
export interface RoundFull extends Round { items: RoundItem[] }
export interface RoundResults { ref: string; status: string; participants: number | null; results_shown: boolean; items: { id: string; label: string; points: number; first_choice: number }[] | null }
export const MAX_RANKED = 5;
const q = encodeURIComponent;

export const fetchRounds = (constituency: string): Promise<OrPlanned<Round[]>> =>
  readOrPlanned<Round[]>(`/priorities?${new URLSearchParams({ constituency, limit: "20" })}`).then((r) => (r.kind === "ok" && !Array.isArray(r.data) ? { ...r, data: [] } : r));
export const fetchRound = (ref: string) => api<RoundFull>(`/priorities/${q(ref)}`).then((r) => r.data);
export const fetchRoundResults = (ref: string) => api<RoundResults>(`/priorities/${q(ref)}/results`).then((r) => r.data);
export const submitRanking = (ref: string, items: string[]) => api<unknown>(`/priorities/${q(ref)}/ranking`, { method: "PUT", body: { items } });

/** Ranking helpers: an ordered list of up to 5 different need ids. */
export const addRank = (list: readonly string[], id: string): string[] => (list.includes(id) || list.length >= MAX_RANKED ? [...list] : [...list, id]);
export const removeRank = (list: readonly string[], id: string): string[] => list.filter((x) => x !== id);
export function moveRank(list: readonly string[], id: string, by: -1 | 1): string[] {
  const i = list.indexOf(id), j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
/** The server gives rank 1 five points down to rank 5 one point. Shown only as a bar relative to the top need, never as a share of anyone's vote. */
export const barWidth = (points: number, top: number) => (top > 0 ? Math.round((points / top) * 100) : 0);

// Office -------------------------------------------------------------------------------------------------------------------------------------------
export interface OfficeRound { ref: string; title: string; status: "draft" | "open" | "closed" | "cancelled"; closes_at: string | null; created_at: string }
export const fetchOfficeRounds = (): Promise<OrPlanned<OfficeRound[]>> => readOrPlanned("/office/priorities");
export const createRound = (b: { constituency: string; title: string; description?: string; items: string[]; closes_at?: string }, key: string) => api<{ ref: string }>("/office/priorities", { body: b, idempotencyKey: key }).then((r) => r.data);
export const setRoundStatus = (ref: string, status: "open" | "closed" | "cancelled") => api<unknown>(`/office/priorities/${q(ref)}/status`, { body: { status } });
