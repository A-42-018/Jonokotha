import { createHash } from "node:crypto";
import { parseRobots, robotsAllows, robotsCrawlDelayMs, type RobotsRules } from "./robots";

/**
 * The only way the ingestion framework touches the network (masterplan §17.6). Rules it enforces on every call:
 * https only; robots.txt of the host is read first and obeyed (an unreachable or erroring robots.txt means no fetch);
 * at least `minIntervalMs` (or the site's Crawl-delay, if longer) between requests to one host; a response size cap;
 * a timeout; no cookies or credentials; an honest User-Agent with a contact. Fetching is injectable so tests never use the network.
 */
export const USER_AGENT = process.env.INGEST_USER_AGENT ?? "JonokothaBot/0.1 (+https://jonokotha.vercel.app/about-data; civic data refresh, respects robots.txt)";

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string>; redirect?: "manual" | "follow" }) => Promise<{ status: number; headers: { get(n: string): string | null }; text(): Promise<string> }>;
export interface FetchDeps { fetch?: FetchLike; now?: () => number; sleep?: (ms: number) => Promise<void>; userAgent?: string }
export interface PoliteResult { outcome: "ok" | "blocked_robots" | "http_error" | "too_large" | "error"; httpStatus?: number; bytes?: number; checksum?: string; body?: string; robotsAllowed: boolean | null; contentType?: string; error?: string }

const lastHit = new Map<string, number>();
const robotsCache = new Map<string, { at: number; rules: RobotsRules | null }>();
export const resetFetcherState = () => { lastHit.clear(); robotsCache.clear(); };

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function politeFetch(url: string, o: { minIntervalMs: number; maxBytes: number; timeoutMs?: number }, deps: FetchDeps = {}): Promise<PoliteResult> {
  const doFetch: FetchLike = deps.fetch ?? ((u, init) => fetch(u, { ...init, credentials: "omit" } as RequestInit) as never);
  const now = deps.now ?? Date.now, sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))), ua = deps.userAgent ?? USER_AGENT;
  let u: URL;
  try { u = new URL(url); } catch { return { outcome: "error", robotsAllowed: null, error: "invalid url" }; }
  if (u.protocol !== "https:") return { outcome: "error", robotsAllowed: null, error: "https only" };

  const call = async (target: string) => {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), o.timeoutMs ?? 15000);
    try { return await doFetch(target, { signal: ctl.signal, headers: { "user-agent": ua, accept: "*/*" }, redirect: "manual" }); } finally { clearTimeout(t); }
  };
  const wait = async (host: string, delay: number) => {
    const gap = Math.max(o.minIntervalMs, delay), last = lastHit.get(host);
    if (last !== undefined && now() - last < gap) await sleep(gap - (now() - last));
    lastHit.set(host, now());
  };

  try {
    // robots.txt first (cached for an hour per host)
    let cached = robotsCache.get(u.host);
    if (!cached || now() - cached.at > 3_600_000) {
      await wait(u.host, 0);
      const r = await call(`${u.origin}/robots.txt`);
      let rules: RobotsRules | null = null;
      if (r.status === 404 || r.status === 410) rules = { groups: [] };           // no robots.txt: nothing is disallowed
      else if (r.status >= 200 && r.status < 300) rules = parseRobots((await r.text()).slice(0, 500_000));
      cached = { at: now(), rules };                                              // 401/403/5xx/redirect: rules stay null = do not fetch
      robotsCache.set(u.host, cached);
    }
    if (!cached.rules || !robotsAllows(cached.rules, ua, u.pathname + u.search)) return { outcome: "blocked_robots", robotsAllowed: false };

    await wait(u.host, robotsCrawlDelayMs(cached.rules, ua));
    const res = await call(u.toString());
    if (res.status < 200 || res.status >= 300) return { outcome: "http_error", httpStatus: res.status, robotsAllowed: true };
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > o.maxBytes) return { outcome: "too_large", httpStatus: res.status, robotsAllowed: true, bytes: declared };
    const body = await res.text();
    const bytes = Buffer.byteLength(body);
    if (bytes > o.maxBytes) return { outcome: "too_large", httpStatus: res.status, robotsAllowed: true, bytes };
    return { outcome: "ok", httpStatus: res.status, bytes, checksum: sha256(body), body, robotsAllowed: true, contentType: res.headers.get("content-type") ?? undefined };
  } catch (e) {
    return { outcome: "error", robotsAllowed: null, error: ((e as Error).name === "AbortError" ? "timeout" : (e as Error).message ?? "fetch failed").slice(0, 200) };
  }
}
