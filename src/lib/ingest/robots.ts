// Minimal robots.txt reader (RFC 9309 subset): groups by User-agent, longest matching Allow/Disallow wins, Allow wins ties, `*` is a wildcard,
// `$` anchors the end. Crawl-delay is returned so the fetcher can slow down further. An unreachable or 5xx robots.txt means "do not fetch".

export interface RobotsRules { groups: { agents: string[]; rules: { allow: boolean; path: string }[]; crawlDelay?: number }[] }

export function parseRobots(text: string): RobotsRules {
  const groups: RobotsRules["groups"] = [];
  let cur: RobotsRules["groups"][number] | null = null, lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase(), value = line.slice(i + 1).trim();
    if (field === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase()); lastWasAgent = true; continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (field === "allow" || field === "disallow") { if (value || field === "allow") cur.rules.push({ allow: field === "allow", path: value }); }
    else if (field === "crawl-delay") { const n = Number(value); if (Number.isFinite(n) && n >= 0) cur.crawlDelay = n; }
  }
  return { groups };
}

const toRegex = (p: string) => new RegExp("^" + p.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\$$/, "$$"));

function groupFor(r: RobotsRules, ua: string) {
  const name = ua.toLowerCase().split("/")[0];
  const specific = r.groups.find((g) => g.agents.some((a) => a !== "*" && name.includes(a)));
  return specific ?? r.groups.find((g) => g.agents.includes("*")) ?? null;
}

export function robotsAllows(r: RobotsRules, ua: string, pathAndQuery: string): boolean {
  const g = groupFor(r, ua);
  if (!g) return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const rule of g.rules) {
    if (!rule.path) continue;
    if (toRegex(rule.path).test(pathAndQuery) && (!best || rule.path.length > best.len || (rule.path.length === best.len && rule.allow))) best = { allow: rule.allow, len: rule.path.length };
  }
  return best ? best.allow : true;
}

export const robotsCrawlDelayMs = (r: RobotsRules, ua: string) => { const d = groupFor(r, ua)?.crawlDelay; return d ? d * 1000 : 0; };
