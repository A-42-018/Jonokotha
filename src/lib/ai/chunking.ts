/**
 * Retrieval chunking (masterplan §17.4): variable-length chunks that break where the topic changes, and a context line
 * for every chunk so a chunk still makes sense on its own ("contextual retrieval").
 *
 * - `chunkText` splits into sentences (Bangla danda and Latin punctuation) and packs them into chunks of different lengths.
 *   With an embedder it starts a new chunk when the next sentence is not similar enough to the previous one
 *   (method "semantic"); without one it only packs by size (method "sentence"). It never throws on an embedder error.
 * - `contextHeader` is the deterministic context line built from the source's own metadata. An optional model-written
 *   line (src/lib/ai/context.ts) can replace it; the header is the fallback, so ingestion never depends on a model.
 */
export type ChunkMethod = "semantic" | "sentence";
export interface TextChunk { text: string; method: ChunkMethod }
export type Embedder = (texts: string[]) => Promise<number[][]>;

export interface ChunkOptions {
  /** Upper bound for one chunk, in characters. A single sentence longer than this is split at word boundaries. */
  maxChars?: number;
  /** A chunk shorter than this is not closed by a topic break (avoids one-sentence chunks). */
  minChars?: number;
  /** Cosine similarity between neighbouring sentences below which a topic break is made. */
  breakBelow?: number;
  embed?: Embedder;
}

export const splitSentences = (text: string): string[] =>
  text.replace(/\s+/g, " ").trim().split(/(?<=[।.!?])\s+/).map((s) => s.trim()).filter(Boolean);

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function hardSplit(s: string, max: number): string[] {
  if (s.length <= max) return [s];
  const out: string[] = [];
  let cur = "";
  for (const w of s.split(" ")) {
    if (cur && cur.length + 1 + w.length > max) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

export async function chunkText(text: string, o: ChunkOptions = {}): Promise<TextChunk[]> {
  const max = o.maxChars ?? 500, min = o.minChars ?? 120, below = o.breakBelow ?? 0.55;
  const sentences = splitSentences(text).flatMap((s) => hardSplit(s, max));
  if (!sentences.length) return [];

  let vecs: number[][] | null = null;
  if (o.embed && sentences.length > 1) {
    try { const v = await o.embed(sentences); if (v.length === sentences.length) vecs = v; } catch { vecs = null; }
  }
  const method: ChunkMethod = vecs ? "semantic" : "sentence";

  const out: TextChunk[] = [];
  let cur = sentences[0];
  for (let i = 1; i < sentences.length; i++) {
    const s = sentences[i];
    const tooLong = cur.length + 1 + s.length > max;
    const topicBreak = !!vecs && cur.length >= min && cosine(vecs[i - 1], vecs[i]) < below;
    if (tooLong || topicBreak) { out.push({ text: cur, method }); cur = s; } else cur = `${cur} ${s}`;
  }
  out.push({ text: cur, method });
  return out;
}

export interface ContextInfo { title: string; source: string; checkedAt: string; agency?: string | null; part?: [number, number] }

/** One line that situates a chunk: which document, which source and date, which agency, which part of the document. */
export function contextHeader(c: ContextInfo): string {
  const parts = [c.title, `source: ${c.source}, checked ${c.checkedAt}`];
  if (c.agency) parts.push(`agency: ${c.agency}`);
  if (c.part && c.part[1] > 1) parts.push(`part ${c.part[0]} of ${c.part[1]}`);
  return `[${parts.join(" | ")}]`;
}

export const withContext = (context: string, chunk: string) => `${context}\n${chunk}`;
