/**
 * Thresholds are set from measurements, never by feel (masterplan §17.7). These helpers take labelled measurements and return the
 * threshold together with the evidence the database requires (`set_ai_threshold` needs n >= 30, metric, method, measured_on).
 */
export const MIN_SAMPLES = 30;

export interface Basis { n: number; metric: string; method: string; measured_on: string; [k: string]: unknown }
export interface Choice { threshold: number; basis: Basis }
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Duplicate similarity: among labelled pairs (score, truly duplicate), the lowest score cut-off whose precision is at least `minPrecision`,
 * i.e. the one that finds the most real duplicates without flooding staff with false matches. Null when there are too few pairs, no
 * duplicates in the sample, or no cut-off reaches the precision.
 */
export function chooseDuplicateThreshold(pairs: { score: number; duplicate: boolean }[], minPrecision = 0.9, measuredOn = today()): Choice | null {
  if (pairs.length < MIN_SAMPLES || !pairs.some((p) => p.duplicate)) return null;
  const totalDup = pairs.filter((p) => p.duplicate).length;
  const cuts = [...new Set(pairs.map((p) => p.score))].sort((a, b) => a - b);
  let best: { cut: number; precision: number; recall: number } | null = null;
  for (const cut of cuts) {
    const sel = pairs.filter((p) => p.score >= cut), tp = sel.filter((p) => p.duplicate).length;
    if (!sel.length) continue;
    const precision = tp / sel.length, recall = tp / totalDup;
    if (precision >= minPrecision && (!best || recall > best.recall)) best = { cut, precision, recall };
  }
  if (!best) return null;
  return { threshold: round(best.cut), basis: { n: pairs.length, metric: `precision >= ${minPrecision}, maximise recall`, method: "labelled duplicate pairs, lowest cut-off meeting the precision floor",
    measured_on: measuredOn, precision: round(best.precision), recall: round(best.recall), duplicates_in_sample: totalDup } };
}

/**
 * Routing confidence: among suggestions with a known outcome (did the office's referral match?), the lowest confidence cut-off at which
 * suggestions at or above it are correct at least `minAccuracy` of the time. Below the cut-off the interface shows the suggestion as
 * "low confidence, check yourself" (it is never applied automatically).
 */
export function chooseRoutingConfidence(rows: { confidence: number; correct: boolean }[], minAccuracy = 0.85, measuredOn = today()): Choice | null {
  if (rows.length < MIN_SAMPLES) return null;
  const cuts = [...new Set(rows.map((r) => r.confidence))].sort((a, b) => a - b);
  for (const cut of cuts) {
    const sel = rows.filter((r) => r.confidence >= cut);
    if (sel.length < Math.ceil(MIN_SAMPLES / 2)) break;       // do not trust a cut-off supported by a handful of cases
    const acc = sel.filter((r) => r.correct).length / sel.length;
    if (acc >= minAccuracy) return { threshold: round(cut), basis: { n: rows.length, metric: `accuracy >= ${minAccuracy} above the cut-off`, method: "AI routing suggestions versus the first agency the office forwarded to",
      measured_on: measuredOn, accuracy_above: round(acc), coverage: round(sel.length / rows.length), cases_above: sel.length } };
  }
  return null;
}

const round = (x: number) => Math.round(x * 1000) / 1000;
