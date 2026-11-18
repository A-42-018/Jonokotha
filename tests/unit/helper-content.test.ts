import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INTENTS } from "@/lib/helper/intents";
import { PAGES } from "@/lib/helper/navigate";
import { GUIDES } from "@/lib/helper/pagehelp";
import { starters, unknownText } from "@/lib/helper/chat";

/** Dadu's lines live in code, not the dictionary, so the Bangla rules of language.test.ts are applied to them here. */
const bn: string[] = [];
const en: string[] = [];
const both = (v: { bn: string; en: string }) => { bn.push(v.bn); en.push(v.en); };
for (const i of INTENTS) { both(i.reply); for (const c of i.chips ?? []) both(c); }
for (const g of Object.values(GUIDES)) { both(g.title); both(g.what); g.steps.forEach(both); if (g.tip) both(g.tip); }
for (const p of PAGES) both(p.label);
bn.push(unknownText("bn"), ...starters("/", "bn").flatMap((s) => [s.label, s.send]));
en.push(unknownText("en"), ...starters("/", "en").flatMap((s) => [s.label, s.send]));

describe("Dadu's Bangla follows the language rules", () => {
  it("no Latin letters, no ASCII digits", () => {
    expect(bn.filter((s) => /[A-Za-z0-9]/.test(s))).toEqual([]);
  });
  it("no formal or sadhu words", () => {
    const sadhu = /(করিয়া|হইবে|হইয়া|করিবেন|করিতে|দিয়াছে|যাইবে|হইতে|কর্তৃক|তাহা|যাহা|হইল)/;
    const formal = /(অভিযোগ|দাখিল|প্রদান করুন|নিবন্ধন|সংশ্লিষ্ট|কার্যালয়|প্রস্তাবনা|প্রেরণ|উন্মুক্ত|বিজ্ঞপ্তি|সংযুক্ত|পর্যবেক্ষণ|সম্পাদনা|গ্রহণ)/;
    expect(bn.filter((s) => sadhu.test(s) || formal.test(s))).toEqual([]);
  });
  it("sentences stay under 21 words", () => {
    expect(bn.filter((s) => s.split(/[।?!;\n]/).some((x) => x.trim().split(/\s+/).length > 20))).toEqual([]);
  });
  it("uses এআই, never Latin AI, and every English line exists", () => {
    expect(en.every((s) => s.trim().length > 0) && bn.every((s) => s.trim().length > 0)).toBe(true);
  });
});

describe("every public page has a guide", () => {
  const PRIVATE = new Set(["admin", "office", "dev", "api", "auth", "lang", "mfa", "land"]);
  const found: string[] = [];
  (function walk(dir: string, route: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { if (!route && PRIVATE.has(name)) continue; walk(full, name.startsWith("(") ? route : `${route}/${name}`); }
      else if (name === "page.tsx") found.push(route || "/");
    }
  })(join(process.cwd(), "src/app"), "");
  const covered = (r: string) => !!GUIDES[r] || Object.keys(GUIDES).some((k) => k !== "/" && r.startsWith(`${k}/`));
  it("walks src/app and finds a guide for each page", () => {
    expect(found.length).toBeGreaterThan(20);
    expect(found.filter((r) => !covered(r))).toEqual([]);
  });
  it("every navigable page is a real route", () => {
    for (const p of PAGES) expect(found.some((r) => r === p.href || r.replace(/\/\[[^\]]+\]/g, "") === p.href), p.href).toBe(true);
  });
});
