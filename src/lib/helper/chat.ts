import { detectEmergency } from "../emergency";
import { normalizeDigits } from "../digits";
import { redactPii } from "../pii";
import { INTENTS, matchIntent } from "./intents";
import { search } from "./kb";
import { guideFor, isPageQuestion, renderGuide } from "./pagehelp";
import { askedQuestion, liveFlags, navigateTo, pageBySlug, toTarget, type Flags, type Slug } from "./navigate";
import { clean, normalize, replyLang } from "./normalize";
import { starters } from "./starters";
import type { Block, ChatRequest, ChatResponse, Lang, Mood } from "./types";

/**
 * Dadu's scripted brain. Order matters and is part of the safety design:
 *   1. emergency words get fixed, reviewed guidance and nothing else (masterplan §17.8)
 *   2. "how do I use this page?" gets the page's own guide
 *   3. voice only: a page name plus a go-cue or a wish opens the page (after a countdown on the client)
 *   4. keyword intents, then BM25 search over what the site already says
 *   5. otherwise "I am not sure", with chips and a way to a person
 * No model is involved here. The optional model layer (src/lib/ai/helper.ts) only sees what is left over, and only for signed-in people.
 */
export interface Ctx { signedIn: boolean; flags?: Flags; loginUrl: (path: string) => string }

const text = (t: string): Block => ({ type: "text", text: t });
export { starters };
export const unknownText = (lang: Lang) => (lang === "bn" ? "এ বিষয়ে আমি নিশ্চিত নই। নিচের কিছু বেছে নিন, বা সাহায্যের পাতা দেখুন।" : "I am not sure about that. Pick one of these, or see the help page.");

function links(slugs: Slug[] | undefined, lang: Lang, flags: Flags): Block[] {
  return (slugs ?? []).flatMap((s) => { const p = pageBySlug(s, flags); return p ? [{ type: "link", href: p.href, label: p.label[lang] } as Block] : []; });
}

export function reply(req: ChatRequest, ctx: Ctx): ChatResponse {
  const flags = ctx.flags ?? liveFlags();
  const last = [...req.messages].reverse().find((m) => m.role === "user")?.text ?? "";
  const lang = replyLang(last, req.lang);
  const done = (blocks: Block[], intent: string, confidence: number, source: ChatResponse["source"], mood: Mood = "talk"): ChatResponse => ({ blocks, intent, confidence, source, lang, mood });

  if (!clean(last)) return done([text(INTENTS[0].reply[lang]), { type: "chips", items: starters(req.page, lang) }], "greet", 1, "rules", "greet");

  const em = detectEmergency(last);
  if (em) return done([{ type: "emergency", text: em.guidance[lang], numbers: em.numbers }], "emergency", 1, "emergency", "sorry");

  const norm = normalize(normalizeDigits(last));
  if (isPageQuestion(norm)) {
    const g = guideFor(req.page);
    return done([text(renderGuide(g, lang))], "page_help", 1, "rules");
  }

  if (req.voice) {
    const p = navigateTo(last, flags);
    if (p) {
      const t = toTarget(p, lang, ctx.signedIn, ctx.loginUrl);
      return done([{ type: "navigate", href: t.href, label: t.label, say: t.say }], `nav_${p.slug}`, 1, "rules", "happy");
    }
  }

  const m = matchIntent(last);
  if (m) {
    const i = m.intent;
    // "I want to …" without a question word goes straight to the page, but only by voice (typed chat never moves the page).
    const blocks: Block[] = [text(i.reply[lang]), ...links(i.links, lang, flags)];
    if (i.chips?.length) blocks.push({ type: "chips", items: i.chips.map((c) => ({ label: c[lang], send: c[lang] })) });
    return done(blocks, i.id, m.confidence, "rules", i.mood ?? (i.id === "thanks" ? "happy" : "talk"));
  }

  const hits = search(askedQuestion(last) ? norm : norm, 2);
  if (hits.length > 0) {
    const e = hits[0].entry;
    const link: Block[] = e.page ? links([slugForRoute(e.page)].filter(Boolean) as Slug[], lang, flags) : [];
    return done([text(e.text[lang]), ...link], e.id, Math.min(0.7, 0.4 + hits[0].score / 20), "kb");
  }

  return done([text(unknownText(lang)), { type: "chips", items: starters(req.page, lang) }, { type: "handoff", links: [{ href: "/help", label: lang === "bn" ? "সাহায্যের পাতা" : "Help page" }, { href: "/help/contact", label: lang === "bn" ? "যোগাযোগ" : "Contact" }] }], "out_of_scope", 0, "rules", "sorry");
}

const ROUTE_SLUG: Record<string, Slug> = { "/": "home", "/report": "report", "/me": "me", "/area": "area", "/projects": "projects", "/ideas": "ideas", "/ideas/new": "ideaNew", "/ask": "ask", "/mp": "mp", "/polls": "polls", "/notifications": "notifications", "/settings": "settings", "/help": "help", "/help/contact": "contact", "/about": "about", "/privacy": "privacy", "/terms": "terms", "/accessibility": "accessibility", "/consultations": "consultations", "/commitments": "commitments", "/priorities": "priorities", "/budget": "budget", "/budgeting": "budgeting", "/open-data": "openData", "/mp-records": "mpRecords", "/rti": "rti", "/volunteer": "volunteer", "/transparency": "transparency" };
const slugForRoute = (r: string): Slug | undefined => ROUTE_SLUG[r];
