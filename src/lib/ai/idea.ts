import { z } from "zod";
import { runAgent } from "./run";
import { IDEA_V1 } from "./prompts";
import { redactPii } from "../pii";

/**
 * Idea Assistant (B5.10; masterplan §17.2): clarity suggestions BEFORE posting. It only suggests; the citizen edits and posts. If the model
 * is unavailable, times out, refuses or answers badly, simple rules produce the questions (the manual path), so the feature never blocks posting.
 */
export const IdeaHelp = z.object({ clearer_title: z.string().trim().max(120).default(""), questions: z.array(z.string().trim().min(3).max(160)).max(4), encouragement: z.string().trim().max(200).default("") });
export type IdeaHelp = z.infer<typeof IdeaHelp>;
export interface IdeaAssist extends IdeaHelp { source: "ai" | "rules"; reason?: string }

const BANGLA = /[ঀ-৿]/;

/** Rule-based fallback: asks for what a concrete idea usually lacks. Language follows the idea. */
export function ruleQuestions(title: string, body: string): IdeaHelp {
  const bn = BANGLA.test(`${title} ${body}`), q: string[] = [], t = `${title} ${body}`;
  const has = (re: RegExp) => re.test(t);
  if (!has(/(road|market|school|ward|union|village|para|বাজার|স্কুল|ওয়ার্ড|ইউনিয়ন|গ্রাম|পাড়া|রাস্তা|সড়ক|মোড়)/i)) q.push(bn ? "ঠিক কোথায় এটি দরকার? জায়গার নাম লিখুন।" : "Where exactly is this needed? Name the place.");
  if (!has(/(children|women|farmers|students|elderly|people|everyone|শিশু|নারী|কৃষক|ছাত্র|বয়স্ক|মানুষ|সবাই|এলাকাবাসী)/i)) q.push(bn ? "এতে কারা উপকৃত হবে?" : "Who would benefit?");
  if (body.trim().length < 80) q.push(bn ? "প্রথম ধাপে কী করা যেতে পারে?" : "What could the first step be?");
  if (!has(/\d/)) q.push(bn ? "আনুমানিক কতটা বা কতজনের জন্য? (একটি সংখ্যা দিন)" : "Roughly how much or for how many people? (give a number)");
  return { clearer_title: "", questions: q.slice(0, 4), encouragement: bn ? "আইডিয়াটি পোস্ট করার আগে এই প্রশ্নগুলোর উত্তর যোগ করলে এটি আরও স্পষ্ট হবে।" : "Answering these before you post will make the idea easier to act on." };
}

export async function ideaAssist(title: string, body: string, ctx: { actorId?: string; requestId?: string; simpleLanguage?: boolean } = {}): Promise<IdeaAssist> {
  const text = redactPii(`${title}\n${body}`).text.slice(0, 2500);
  const out = await runAgent({ agent: "idea", prompt: IDEA_V1, schema: IdeaHelp, input: text, maxTokens: 500, ...ctx, tool: { name: "submit_suggestions", description: "Return clarity suggestions for the idea." } });
  if (out.ok) return { ...out.data, source: "ai" };
  return { ...ruleQuestions(title, body), source: "rules", reason: out.reason };
}
