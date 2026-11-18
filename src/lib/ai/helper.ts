import { z } from "zod";
import { redactPii } from "../pii";
import { search } from "../helper/kb";
import { guideFor, renderGuide } from "../helper/pagehelp";
import { offered, type Flags } from "../helper/navigate";
import type { Block, Lang } from "../helper/types";
import { HELPER_V1 } from "./prompts";
import { runAgent } from "./run";

/**
 * Dadu's optional model layer. It runs only for signed-in people (every other model route in jonokotha needs sign-in), only when the `helper_ai` flag is on and a key exists,
 * and only for a question the scripted brain could not answer well. It sees the question (personal details removed), the page guide and the top site entries, and nothing else.
 * Whatever it writes is checked: a phone number, an email or a web address means the answer is thrown away; pages outside the whitelist are dropped; any failure returns
 * `null`, and the caller keeps the scripted answer. The result is labelled as AI text in the panel (masterplan §17.8).
 */
export const HelperAnswer = z.object({
  text: z.string().trim().min(2).max(800),
  known: z.boolean(),
  pages: z.array(z.string().max(40)).max(3).default([]),
  follow_ups: z.array(z.string().trim().min(3).max(100)).max(3).default([]),
});

export const leaks = (s: string): boolean => redactPii(s).found.length > 0 || /https?:\/\/|www\./i.test(s);
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, "")}…`);

export async function helperAi(question: string, lang: Lang, page: string, flags: Flags, ctx: { actorId?: string; requestId?: string; simpleLanguage?: boolean } = {}): Promise<{ blocks: Block[] } | null> {
  const q = redactPii(question).text.slice(0, 400);
  const hits = search(q, 4);
  const entries = [`[0] ${guideFor(page).title[lang]}: ${clip(renderGuide(guideFor(page), lang), 700)}`, ...hits.map((h, i) => `[${i + 1}] ${h.entry.title[lang]}: ${clip(h.entry.text[lang], 700)}`)].join("\n");
  const allowed = offered(flags);
  const input = `OUTPUT_LANGUAGE: ${lang}\nPAGE: ${page}\nALLOWED_PAGES: ${allowed.map((p) => p.href).join(", ")}\nQUESTION: ${q}\nENTRIES:\n${entries}`;
  const out = await runAgent({ agent: "helper", prompt: HELPER_V1, schema: HelperAnswer, input, maxTokens: 500, timeoutMs: 15_000, ...ctx, tool: { name: "answer", description: "Answer from the entries." } });
  if (!out.ok) return null;
  const d = out.data;
  if (leaks(d.text) || d.follow_ups.some(leaks)) return null;
  const blocks: Block[] = [{ type: "text", text: d.text }];
  for (const p of [...new Set(d.pages)].map((h) => allowed.find((x) => x.href === h)).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 3)) blocks.push({ type: "link", href: p.href, label: p.label[lang] });
  if (d.follow_ups.length) blocks.push({ type: "chips", items: d.follow_ups.map((f) => ({ label: f, send: f })) });
  if (!d.known) blocks.push({ type: "handoff", links: [{ href: "/help", label: lang === "bn" ? "সাহায্যের পাতা" : "Help page" }, { href: "/help/contact", label: lang === "bn" ? "যোগাযোগ" : "Contact" }] });
  return { blocks };
}
