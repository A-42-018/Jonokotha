import { redactPii } from "../pii";

/** A staged record: stable key plus payload. Nothing here is published; a person reviews staged records (admin API). */
export interface Staged { key: string; payload: Record<string, unknown> }

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/** Visible text of an HTML page, roughly: scripts and styles dropped, tags removed, whitespace collapsed. */
export function htmlToText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

/** Evidence that a page mentions a helpline number as a whole token. The snippet is a short window of the page, with personal data removed. */
export function helplineEvidence(page: string, number: string): { found: boolean; snippet: string | null } {
  const text = htmlToText(page);
  const m = new RegExp(`(?<![0-9০-৯])${number}(?![0-9০-৯])`).exec(text);
  if (!m) return { found: false, snippet: null };
  return { found: true, snippet: redactPii(clip(text.slice(Math.max(0, m.index - 80), m.index + number.length + 80), 200)).text };
}

/** GeoJSON FeatureCollection -> one record per feature that has a stable id. Geometry is kept out of the staging payload (only its bbox). */
export function parseGeoJson(body: string): Staged[] {
  const j = JSON.parse(body) as { type?: string; features?: { id?: unknown; properties?: Record<string, unknown>; geometry?: { coordinates?: unknown } }[] };
  if (j.type !== "FeatureCollection" || !Array.isArray(j.features)) throw new Error("not a FeatureCollection");
  const out: Staged[] = [];
  for (const f of j.features.slice(0, 2000)) {
    const p = f.properties ?? {};
    const id = f.id ?? p.id ?? p.code ?? p.pcode ?? p.ADM_PCODE;
    if (id === undefined || id === null) continue;
    const nums = JSON.stringify(f.geometry?.coordinates ?? []).match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    const lngs = nums.filter((_, i) => i % 2 === 0), lats = nums.filter((_, i) => i % 2 === 1);
    out.push({ key: String(id), payload: { properties: p, bbox: nums.length ? [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] : null } });
  }
  return out;
}

/** A JSON array of objects, each with `id` or `key`. */
export function parseJsonList(body: string): Staged[] {
  const j = JSON.parse(body) as unknown;
  const arr = Array.isArray(j) ? j : (j as { items?: unknown[] }).items;
  if (!Array.isArray(arr)) throw new Error("not a list");
  const out: Staged[] = [];
  for (const it of arr.slice(0, 2000)) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>, id = o.id ?? o.key;
    if (id === undefined) continue;
    out.push({ key: String(id), payload: o });
  }
  return out;
}

/** Links on a page (service directory, GRS): href + text, same-site only, so a directory page becomes reviewable records. */
export function parseLinks(html: string, baseUrl: string): Staged[] {
  const base = new URL(baseUrl), out = new Map<string, Staged>();
  for (const m of html.matchAll(/<a\s[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u: URL;
    try { u = new URL(m[1], base); } catch { continue; }
    if (u.protocol !== "https:" || u.host !== base.host) continue;
    const text = htmlToText(m[2]);
    if (text.length < 3 || out.size >= 500) continue;
    out.set(u.pathname + u.search, { key: u.pathname + u.search, payload: { href: u.toString(), text: clip(text, 160) } });
  }
  return [...out.values()];
}

export function parseByKind(kind: string, body: string, baseUrl: string, contentType = ""): Staged[] {
  const looksJson = /json/i.test(contentType) || /^\s*[[{]/.test(body);
  if (kind === "boundaries") return parseGeoJson(body);
  if (kind === "osm" || kind === "representatives") return looksJson ? parseJsonList(body) : [];
  if (kind === "service_directory" || kind === "grs_link") return looksJson ? parseJsonList(body) : parseLinks(body, baseUrl);
  return [];   // helpline sources are handled by evidence, not parsed into records here
}
