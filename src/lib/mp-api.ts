import { api } from "@/lib/api-client";

/** Representative as the API gives it (verified only). Every public fact has a source and a check date. */
export interface ApiRep {
  id: string; full_name: string; full_name_bn?: string | null; party_name_bn?: string | null; photo_path?: string | null; role_note?: string | null; office_title: string | null; party_name?: string | null; official_contact: string | null;
  source_url: string | null; verified_at: string | null; is_sample: boolean;
}
export interface ApiArea { key: string; name_bn: string; name_en: string; district: string | null; is_demo: boolean }
export interface LookupMatch { constituency: ApiArea; representatives: ApiRep[] }
export interface Lookup { matches: LookupMatch[]; needs_manual_choice: boolean }

export interface RepField { field: string; value: string; source_url: string; checked_at: string }
export interface RepDetail extends ApiRep {
  constituencies: (ApiArea & { valid_from: string; valid_to: string | null })[];
  fields?: RepField[];
  announcements: { ref: string; title: string; body: string; published_at: string }[];
}
export interface Responsiveness {
  constituency: string; is_sample: boolean; from: string; to: string; received: number; answered: number; pending: number;
  median_hours_to_first_response: number | null; method_url: string; note: string;
}

/** What the card shows, whichever endpoint it came from. */
export interface RepView { id: string; name: string; role: string; constituency: string; verifiedAt: string | null; source: string | null; sample: boolean; party?: string | null; photoUrl?: string | null; roleNote?: string | null }

/** Public URL of a stored MP photo (bucket rep-photos), or null when there is none. */
export const repPhotoUrl = (path: string | null | undefined): string | null => (path && process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rep-photos/${encodeURIComponent(path)}` : null);

export function repView(r: ApiRep, area: ApiArea | undefined, lang: "bn" | "en", fallbackRole: string): RepView {
  return {
    id: r.id, name: lang === "bn" ? r.full_name_bn || r.full_name : r.full_name, party: lang === "bn" ? r.party_name_bn || r.party_name || null : r.party_name ?? null, photoUrl: repPhotoUrl(r.photo_path), roleNote: r.role_note ?? null, role: r.office_title || fallbackRole, constituency: area ? (lang === "bn" ? area.name_bn : area.name_en) : "",
    verifiedAt: r.verified_at, source: r.source_url, sample: r.is_sample,
  };
}

/** Host of a source link, for display ("example.org"), never the whole URL. */
export function sourceHost(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname; } catch { return null; }
}

export const lookupByArea = (area: string) => api<Lookup>(`/representatives/lookup?${new URLSearchParams({ area })}`).then((r) => r.data);
export const lookupByPoint = (lat: number, lng: number) => api<Lookup>(`/representatives/lookup?${new URLSearchParams({ lat: String(lat), lng: String(lng) })}`).then((r) => r.data);
export const fetchRep = (id: string) => api<RepDetail>(`/representatives/${encodeURIComponent(id)}`).then((r) => r.data);
export const fetchResponsiveness = (key: string) => api<Responsiveness>(`/constituencies/${encodeURIComponent(key)}/responsiveness`).then((r) => r.data);

export const answeredPercent = (r: Pick<Responsiveness, "received" | "answered">) => (r.received === 0 ? 0 : Math.round((r.answered / r.received) * 100));
/** Median first-response time in whole hours, or in days when it is a day or more. */
export function medianLabel(hours: number | null): { unit: "hours" | "days"; n: number } | null {
  if (hours === null || hours === undefined) return null;
  return hours >= 24 ? { unit: "days", n: Math.round(hours / 24) } : { unit: "hours", n: Math.max(1, Math.round(hours)) };
}
