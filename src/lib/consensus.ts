/**
 * Consensus mapping (B7.1; masterplan §7.14). Pure functions: no database, no model.
 *
 * Input is the vote matrix the database returns to office staff: participants are numbered per request and carry NO identity.
 * Output is aggregates only. Rules enforced here AND again by the database (save_consultation_report drops groups under 5):
 *   - a statement's overall figures need at least MIN_GROUP votes, otherwise they are hidden
 *   - a group needs at least MIN_GROUP people, otherwise it is not reported (only that some group was hidden)
 *   - groups are labelled A and B; nothing about who is in them is computed or stored
 * Grouping is two-means on the vote vectors (agree = +1, disagree = -1, pass or no vote = 0) with a deterministic start, so the same data
 * always gives the same groups. With fewer than 2 x MIN_GROUP participants there is one undivided group.
 */
export const MIN_GROUP = 5;
export type VoteKind = "agree" | "disagree" | "pass";
export interface VoteRow { participant: number; statement_id: string; vote: VoteKind }
export interface StatementRef { id: string; text: string }
export type Pattern = "common_ground" | "divided" | "mixed" | "low_support";
export interface GroupOut { group: string; size: number }
export interface AgreementOut {
  statement_id: string; text: string; votes: number | null; agree_pct: number | null; disagree_pct: number | null; pass_pct: number | null;
  groups: { group: string; votes: number; agree_pct: number | null }[]; pattern: Pattern | null;
}
export interface Consensus { participants: number; groups: GroupOut[]; hidden_groups: number; agreement: AgreementOut[]; suppressed: boolean }

const SCORE: Record<VoteKind, number> = { agree: 1, disagree: -1, pass: 0 };
const pct = (n: number, d: number) => Math.round((n / d) * 1000) / 10;

function dist(a: number[], b: number[]) { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s; }

/** Two-means with a deterministic start: the first participant, the one farthest from them, then the one farthest from that. */
export function twoMeans(vectors: number[][], iterations = 25): number[] {
  const n = vectors.length;
  if (n < 2) return vectors.map(() => 0);
  const far = (from: number[]) => { let best = 0, bd = -1; vectors.forEach((v, i) => { const d = dist(v, from); if (d > bd) { bd = d; best = i; } }); return best; };
  const a = far(vectors[0]), b = far(vectors[a]);
  let ca = [...vectors[a]], cb = [...vectors[b]];
  let assign = new Array<number>(n).fill(0);
  for (let it = 0; it < iterations; it++) {
    const next = vectors.map((v) => (dist(v, ca) <= dist(v, cb) ? 0 : 1));
    const same = next.every((x, i) => x === assign[i]);
    assign = next;
    const mean = (g: number) => { const m = new Array<number>(vectors[0].length).fill(0); let c = 0; vectors.forEach((v, i) => { if (assign[i] === g) { c++; v.forEach((x, j) => { m[j] += x; }); } }); return c ? m.map((x) => x / c) : (g === 0 ? ca : cb); };
    ca = mean(0); cb = mean(1);
    if (same && it > 0) break;
  }
  return assign;
}

export function buildConsensus(matrix: VoteRow[], statements: StatementRef[], min = MIN_GROUP): Consensus {
  const ids = statements.map((s) => s.id), col = new Map(ids.map((id, i) => [id, i]));
  const people = [...new Set(matrix.map((r) => r.participant))].sort((a, b) => a - b);
  const row = new Map(people.map((p, i) => [p, i]));
  const vectors = people.map(() => new Array<number>(ids.length).fill(0));
  const voted = people.map(() => new Array<VoteKind | null>(ids.length).fill(null));
  for (const r of matrix) {
    const i = row.get(r.participant), j = col.get(r.statement_id);
    if (i === undefined || j === undefined || !(r.vote in SCORE)) continue;
    vectors[i][j] = SCORE[r.vote]; voted[i][j] = r.vote;
  }
  const participants = people.length;
  if (participants < min) return { participants, groups: [], hidden_groups: 0, agreement: [], suppressed: true };

  let assign = new Array<number>(participants).fill(0);
  if (participants >= 2 * min) assign = twoMeans(vectors);
  const sizes = [0, 1].map((g) => assign.filter((x) => x === g).length);
  let hidden = 0;
  const label = ["A", "B"];
  const shown = new Set<number>();
  [0, 1].forEach((g) => { if (sizes[g] >= min) shown.add(g); else if (sizes[g] > 0) hidden++; });
  const groups: GroupOut[] = [...shown].map((g) => ({ group: label[g], size: sizes[g] }));

  const agreement: AgreementOut[] = statements.map((s, j) => {
    const counts = { agree: 0, disagree: 0, pass: 0 };
    voted.forEach((v) => { const x = v[j]; if (x) counts[x]++; });
    const total = counts.agree + counts.disagree + counts.pass;
    const overallShown = total >= min;
    const perGroup = [...shown].map((g) => {
      let a = 0, t = 0;
      voted.forEach((v, i) => { if (assign[i] === g && v[j]) { t++; if (v[j] === "agree") a++; } });
      return { group: label[g], votes: t >= min ? t : 0, agree_pct: t >= min ? pct(a, t) : null };
    });
    const known = perGroup.filter((g) => g.agree_pct !== null) as { agree_pct: number }[];
    let pattern: Pattern | null = null;
    if (overallShown) {
      if (known.length >= 2 && Math.max(...known.map((g) => g.agree_pct)) - Math.min(...known.map((g) => g.agree_pct)) >= 40) pattern = "divided";
      else if (counts.agree / total >= 0.66 && known.every((g) => g.agree_pct >= 60)) pattern = "common_ground";
      else if (counts.agree / total < 0.34 && counts.disagree / total >= 0.5) pattern = "low_support";
      else pattern = "mixed";
    }
    return { statement_id: s.id, text: s.text, votes: overallShown ? total : null,
      agree_pct: overallShown ? pct(counts.agree, total) : null, disagree_pct: overallShown ? pct(counts.disagree, total) : null, pass_pct: overallShown ? pct(counts.pass, total) : null,
      groups: perGroup, pattern };
  });
  return { participants, groups, hidden_groups: hidden, agreement, suppressed: false };
}
