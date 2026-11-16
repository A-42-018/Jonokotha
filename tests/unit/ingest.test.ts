import { beforeEach, describe, expect, it } from "vitest";
import { parseRobots, robotsAllows, robotsCrawlDelayMs } from "../../src/lib/ingest/robots";
import { politeFetch, resetFetcherState, sha256, type FetchLike } from "../../src/lib/ingest/fetcher";
import { helplineEvidence, htmlToText, parseByKind, parseGeoJson, parseJsonList, parseLinks } from "../../src/lib/ingest/parse";

const UA = "JonokothaBot/0.1";

describe("robots.txt", () => {
  it("applies the longest matching rule, with Allow winning ties, and a specific group over *", () => {
    const r = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/open\nCrawl-delay: 10\n\nUser-agent: JonokothaBot\nDisallow: /nope$\n");
    expect(robotsAllows(r, UA, "/data")).toBe(true);
    expect(robotsAllows(r, UA, "/nope")).toBe(false);
    expect(robotsAllows(r, UA, "/nope/more")).toBe(true);            // $ anchors the end
    expect(robotsAllows(r, "OtherBot/1", "/private/x")).toBe(false);
    expect(robotsAllows(r, "OtherBot/1", "/private/open/x")).toBe(true);
    expect(robotsCrawlDelayMs(r, "OtherBot/1")).toBe(10000);
    expect(robotsCrawlDelayMs(r, UA)).toBe(0);
  });
  it("handles wildcards, comments, empty Disallow and no groups", () => {
    const r = parseRobots("# hi\nUser-agent: *\nDisallow: /*.pdf$ # no pdfs\nDisallow:\n");
    expect(robotsAllows(r, UA, "/a/b.pdf")).toBe(false);
    expect(robotsAllows(r, UA, "/a/b.pdf?x=1")).toBe(true);
    expect(robotsAllows(parseRobots(""), UA, "/anything")).toBe(true);
    expect(robotsAllows(parseRobots("User-agent: *\nDisallow: /"), UA, "/x")).toBe(false);
  });
});

const res = (status: number, body = "", headers: Record<string, string> = {}) => ({ status, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null }, text: async () => body });
function harness(routes: Record<string, ReturnType<typeof res>>) {
  const calls: { url: string; at: number }[] = []; let t = 1_000_000;
  const fetch: FetchLike = async (url) => { calls.push({ url, at: t }); const r = routes[new URL(url).pathname]; if (!r) throw new Error("unexpected " + url); return r; };
  return { calls, deps: { fetch, now: () => t, sleep: async (ms: number) => { t += ms; }, userAgent: UA }, advance: (ms: number) => { t += ms; } };
}
const opts = { minIntervalMs: 2000, maxBytes: 1000 };

describe("politeFetch", () => {
  beforeEach(() => resetFetcherState());
  it("reads robots.txt first, then fetches, waits between requests to the same host, and returns a checksum", async () => {
    const h = harness({ "/robots.txt": res(200, "User-agent: *\nDisallow: /secret"), "/data.json": res(200, "[1,2,3]", { "content-type": "application/json" }) });
    const r = await politeFetch("https://example.org/data.json", opts, h.deps);
    expect(r).toMatchObject({ outcome: "ok", httpStatus: 200, robotsAllowed: true, bytes: 7, contentType: "application/json" });
    expect(r.checksum).toBe(sha256("[1,2,3]"));
    expect(h.calls.map((c) => new URL(c.url).pathname)).toEqual(["/robots.txt", "/data.json"]);
    expect(h.calls[1].at - h.calls[0].at).toBeGreaterThanOrEqual(2000);
  });
  it("does not fetch a disallowed path, and treats a forbidden or failing robots.txt as 'do not fetch'", async () => {
    const h = harness({ "/robots.txt": res(200, "User-agent: *\nDisallow: /secret"), "/secret/a": res(200, "x") });
    expect((await politeFetch("https://example.org/secret/a", opts, h.deps)).outcome).toBe("blocked_robots");
    expect(h.calls.some((c) => c.url.endsWith("/secret/a"))).toBe(false);
    for (const status of [401, 403, 500, 301]) {
      resetFetcherState();
      const g = harness({ "/robots.txt": res(status), "/x": res(200, "x") });
      expect((await politeFetch(`https://h${status}.example.org/x`, opts, g.deps)).outcome, String(status)).toBe("blocked_robots");
      expect(g.calls).toHaveLength(1);
    }
  });
  it("a missing robots.txt (404) allows fetching; Crawl-delay slows requests further", async () => {
    const h = harness({ "/robots.txt": res(404), "/x": res(200, "ok") });
    expect((await politeFetch("https://nodelay.example.org/x", opts, h.deps)).outcome).toBe("ok");
    resetFetcherState();
    const g = harness({ "/robots.txt": res(200, "User-agent: *\nCrawl-delay: 30"), "/x": res(200, "ok") });
    await politeFetch("https://delay.example.org/x", opts, g.deps);
    expect(g.calls[1].at - g.calls[0].at).toBeGreaterThanOrEqual(30000);
  });
  it("refuses http, caps the size (declared and actual), reports http errors, and never follows redirects", async () => {
    const h = harness({ "/robots.txt": res(404), "/big": res(200, "x".repeat(5000)), "/declared": res(200, "x", { "content-length": "99999" }), "/gone": res(500), "/moved": res(301) });
    expect((await politeFetch("http://example.org/x", opts, h.deps))).toMatchObject({ outcome: "error", error: "https only" });
    expect((await politeFetch("https://size.example.org/big", opts, h.deps)).outcome).toBe("too_large");
    expect((await politeFetch("https://size.example.org/declared", opts, h.deps)).outcome).toBe("too_large");
    expect((await politeFetch("https://size.example.org/gone", opts, h.deps))).toMatchObject({ outcome: "http_error", httpStatus: 500 });
    expect((await politeFetch("https://size.example.org/moved", opts, h.deps))).toMatchObject({ outcome: "http_error", httpStatus: 301 });
    expect((await politeFetch("not a url", opts, h.deps)).outcome).toBe("error");
  });
});

describe("parsers", () => {
  it("helpline evidence finds the number as a whole token and strips personal data from the snippet", () => {
    const html = "<html><script>var x=999999;</script><body><p>Call <b>999</b> for emergencies. Or ring 01712345678.</p><p>Helpline 3330 is something else</p></body></html>";
    const e = helplineEvidence(html, "999");
    expect(e.found).toBe(true); expect(e.snippet).toContain("999"); expect(e.snippet).not.toContain("01712345678");
    expect(helplineEvidence(html, "333").found).toBe(false);          // 3330 is not 333
    expect(helplineEvidence(html, "109")).toEqual({ found: false, snippet: null });
    expect(htmlToText("<style>a{}</style><p>A &amp; B</p>")).toBe("A & B");
  });
  it("GeoJSON features become keyed records with only a bbox, JSON lists need ids, links stay on the host", () => {
    const gj = JSON.stringify({ type: "FeatureCollection", features: [
      { id: "BD1", properties: { name: "A" }, geometry: { type: "Polygon", coordinates: [[[90, 23], [91, 23], [91, 24], [90, 23]]] } },
      { properties: { name: "no id" }, geometry: null }, { properties: { pcode: "P2" }, geometry: null }] });
    const out = parseGeoJson(gj);
    expect(out.map((o) => o.key)).toEqual(["BD1", "P2"]);
    expect(out[0].payload.bbox).toEqual([90, 23, 91, 24]);
    expect(JSON.stringify(out[0].payload)).not.toContain("coordinates");
    expect(() => parseGeoJson("{}")).toThrow();
    expect(parseJsonList('[{"id":1,"a":2},{"a":3},"x"]').map((o) => o.key)).toEqual(["1"]);
    const links = parseLinks('<a href="/services/a">Birth registration</a><a href="https://other.org/x">Elsewhere</a><a href="http://example.org/y">Insecure</a><a href="/z">x</a>', "https://example.org/dir");
    expect(links.map((l) => l.key)).toEqual(["/services/a"]);
    expect(parseByKind("helpline", "<p>999</p>", "https://example.org")).toEqual([]);
    expect(parseByKind("boundaries", gj, "https://example.org")).toHaveLength(2);
  });
});
