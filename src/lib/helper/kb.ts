import { GUIDES } from "./pagehelp";
import { INTENTS } from "./intents";
import { normalize, tokens } from "./normalize";
import type { Bi } from "./types";

/**
 * Small BM25 search over what the site already says (the intent answers and the page guides), for questions the keyword table did not catch.
 * A word in an entry's title counts for more than the same word in its body; Bangla endings are stripped so "রিপোর্টে" and "রিপোর্ট" meet.
 * If nothing scores, Dadu says he is not sure: nothing is invented.
 */
export interface KbEntry { id: string; title: Bi; text: Bi; page?: string }

const stem = (w: string): string => { if (!/^[ঀ-৿]+$/.test(w)) return w; const s = w.replace(/(গুলো|গুলি|দের|েরা|তে|ের|কে|র|টি|টা|ে)$/, ""); return s.length >= 2 ? s : w; };
const words = (s: string) => tokens(normalize(s)).map(stem);

export const KB: KbEntry[] = [
  ...INTENTS.filter((i) => !i.social).map((i) => ({ id: `intent-${i.id}`, title: { bn: i.kw[0][0], en: i.id }, text: i.reply })),
  ...Object.entries(GUIDES).map(([route, g]) => ({ id: `page-${route}`, title: g.title, text: { bn: `${g.what.bn} ${g.steps.map((s) => s.bn).join(" ")}`, en: `${g.what.en} ${g.steps.map((s) => s.en).join(" ")}` }, page: route })),
];

const INDEX = KB.map((e) => ({ e, ws: words(`${e.title.bn} ${e.title.en} ${e.text.bn} ${e.text.en}`), head: new Set(words(`${e.title.bn} ${e.title.en}`)) }));
const AVG = INDEX.reduce((s, d) => s + d.ws.length, 0) / INDEX.length;
const DF = new Map<string, number>();
for (const d of INDEX) for (const w of new Set(d.ws)) DF.set(w, (DF.get(w) ?? 0) + 1);
const STOP = new Set(["কি", "কী", "এর", "ও", "আর", "কত", "করব", "করে", "আছে", "এই", "আমি", "আমার", "কোথায়", "কোন", "কিভাবে", "কীভাবে", "the", "a", "an", "of", "to", "in", "is", "do", "i", "how", "what", "my", "for", "and", "can", "me", "পাতা", "page"].map((w) => w.normalize("NFC")));

export function search(question: string, k = 3): { entry: KbEntry; score: number }[] {
  const q = [...new Set(words(question).filter((w) => !STOP.has(w) && w.length > 1))];
  const N = INDEX.length, K1 = 1.5, B = 0.4;
  return INDEX.map(({ e, ws, head }) => {
    const tf = new Map<string, number>();
    for (const w of ws) tf.set(w, (tf.get(w) ?? 0) + 1);
    let score = 0;
    for (const w of q) {
      const f = tf.get(w) ?? 0;
      if (!f) continue;
      const df = DF.get(w) ?? 0, idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * ws.length) / AVG))) + (head.has(w) ? 2 * idf : 0);
    }
    return { entry: e, score };
  }).filter((x) => x.score > 0).sort((a, c) => c.score - a.score).slice(0, k);
}
