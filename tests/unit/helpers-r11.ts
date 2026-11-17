import { vi } from "vitest";

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

/** Fakes `fetch` for /api/v1. Routes are keyed "METHOD /path" (no query string, no /api/v1). Unlisted routes answer 404. */
export function stub(routes: Record<string, (body?: unknown, url?: string) => Response>) {
  const calls: { key: string; body?: unknown; url: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(url).replace("/api/v1", "").split("?")[0]}`;
    const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ key, body, url: String(url) });
    const r = routes[key];
    return r ? r(body, String(url)) : json(404, { code: "not_found" });
  }));
  return calls;
}
