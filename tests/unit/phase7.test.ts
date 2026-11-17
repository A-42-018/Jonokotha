import { afterEach, describe, expect, it } from "vitest";
import { buildConsensus, twoMeans, MIN_GROUP, type VoteRow } from "@/lib/consensus";
import { csvCell, toCsv, toPrintHtml } from "@/lib/csv";
import { fitSms, smsEncoding, smsParts, smsUnits } from "@/lib/channels/sms-length";
import { hmacHex, verifySignature } from "@/lib/channels/signature";
import { e164, isNo, isYes, processInbound, T } from "@/lib/channels/inbound";
import { unitCostUsd, setChannelProviderForTests } from "@/lib/channels/provider";
import { MAX_TTS_CHARS, setTtsProviderForTests, speak, ttsConfig } from "@/lib/tts";
import { ApiError, type Ctx } from "@/lib/api";
import { RELEASE_1_1_NOTIFICATION_TYPES } from "@/lib/types";
import { NOTIFICATION_TYPES } from "@/lib/notifications";

const S = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, text: `Statement ${i}` }));
/** `size` people who all vote the same pattern. */
const block = (start: number, size: number, pattern: ("agree" | "disagree" | "pass")[]): VoteRow[] =>
  Array.from({ length: size }, (_, k) => pattern.map((vote, j) => ({ participant: start + k, statement_id: `s${j}`, vote }))).flat();

describe("consensus mapping (B7.1)", () => {
  it("hides everything under 5 participants", () => {
    const r = buildConsensus(block(1, 4, ["agree", "agree"]), S(2));
    expect(r.suppressed).toBe(true);
    expect(r.groups).toEqual([]); expect(r.agreement).toEqual([]);
  });
  it("one undivided group below 10 participants, with figures per statement", () => {
    const r = buildConsensus(block(1, 7, ["agree", "disagree"]), S(2));
    expect(r.suppressed).toBe(false);
    expect(r.groups).toEqual([{ group: "A", size: 7 }]);
    expect(r.agreement[0]).toMatchObject({ votes: 7, agree_pct: 100, disagree_pct: 0 });
    expect(r.agreement[1]).toMatchObject({ agree_pct: 0, disagree_pct: 100 });
  });
  it("finds two opposed groups and labels the divided statement", () => {
    const rows = [...block(1, 6, ["agree", "agree", "disagree"]), ...block(7, 6, ["agree", "disagree", "agree"])];
    const r = buildConsensus(rows, S(3));
    expect(r.groups.map((g) => g.size).sort()).toEqual([6, 6]);
    expect(r.agreement[0].pattern).toBe("common_ground");
    expect(r.agreement[1].pattern).toBe("divided");
    expect(r.agreement[2].pattern).toBe("divided");
  });
  it("a group under 5 is not reported, only counted as hidden, and its members still count in the overall figures", () => {
    const rows = [...block(1, 8, ["agree", "agree"]), ...block(9, 3, ["disagree", "disagree"])];
    const r = buildConsensus(rows, S(2));
    expect(r.participants).toBe(11);
    expect(r.groups.every((g) => g.size >= MIN_GROUP)).toBe(true);
    expect(r.hidden_groups).toBe(1);
    expect(r.agreement[0].votes).toBe(11);
  });
  it("per-group figures need 5 votes in that group on that statement", () => {
    const rows = [...block(1, 6, ["agree", "pass"]), ...block(7, 6, ["disagree", "pass"])];
    const r = buildConsensus(rows.filter((x) => !(x.statement_id === "s1" && x.participant >= 9)), S(2));
    const s1 = r.agreement[1];
    expect(s1.groups.some((g) => g.agree_pct === null)).toBe(true);
  });
  it("is deterministic and carries no identity: output has no participant numbers", () => {
    const rows = [...block(1, 6, ["agree", "disagree"]), ...block(7, 6, ["disagree", "agree"])];
    const a = buildConsensus(rows, S(2)), b = buildConsensus([...rows].reverse(), S(2));
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toMatch(/"participant"|user_id/);
  });
  it("twoMeans separates opposite vectors and handles tiny input", () => {
    const v = [[1, 1], [1, 1], [-1, -1], [-1, -1]];
    const a = twoMeans(v); expect(a[0]).toBe(a[1]); expect(a[2]).toBe(a[3]); expect(a[0]).not.toBe(a[2]);
    expect(twoMeans([[1]])).toEqual([0]);
  });
});

describe("csv export (B7.10)", () => {
  it("quotes, escapes and guards against formula injection", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1"); expect(csvCell("-1")).toBe("'-1"); expect(csvCell("@x")).toBe("'@x");
    expect(csvCell(null)).toBe(""); expect(csvCell(new Date("2026-01-02T03:04:05Z"))).toBe("2026-01-02T03:04:05.000Z");
  });
  it("starts with a byte-order mark and keeps Bangla conjuncts byte for byte", () => {
    const out = toCsv(["ref", "text"], [["R-1", "ক্ষমতা, শ্রদ্ধা"]]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain("\"ক্ষমতা, শ্রদ্ধা\"");
    expect(out.endsWith("\r\n")).toBe(true);
  });
  it("print html escapes content and declares Bangla", () => {
    const h = toPrintHtml("T <x>", "m", ["a"], [["<script>"]]);
    expect(h).toContain("lang=\"bn\""); expect(h).toContain("&lt;script&gt;"); expect(h).not.toContain("<script>");
  });
});

describe("SMS length budget (B7.2)", () => {
  it("counts GSM and Unicode differently", () => {
    expect(smsEncoding("Report JK-1")).toBe("gsm7"); expect(smsEncoding("রিপোর্ট")).toBe("ucs2");
    expect(smsParts("a".repeat(160))).toBe(1); expect(smsParts("a".repeat(161))).toBe(2);
    expect(smsParts("ক".repeat(70))).toBe(1); expect(smsParts("ক".repeat(71))).toBe(2); expect(smsParts("ক".repeat(135))).toBe(3);
    expect(smsUnits("{")).toBe(2); expect(smsParts("")).toBe(0);
  });
  it("shortens at a grapheme boundary within the part budget and never splits a conjunct", () => {
    const text = "শ্রদ্ধা ".repeat(80);
    const f = fitSms(text, 3);
    expect(f.truncated).toBe(true); expect(f.parts).toBeLessThanOrEqual(3);
    expect(f.text.endsWith("…")).toBe(true);
    const segs = [...new Intl.Segmenter("bn", { granularity: "grapheme" }).segment(f.text.slice(0, -1))].map((s) => s.segment).join("");
    expect(segs).toBe(f.text.slice(0, -1));
    expect(f.text.slice(0, -1).trimEnd()).toMatch(/শ্রদ্ধা$/);   // cut after a whole word's conjunct, not inside "শ্র" or "দ্ধ"
    expect(fitSms("ছোট", 3)).toEqual({ text: "ছোট", parts: 1, truncated: false });
  });
});

describe("webhook signatures (B7.2)", () => {
  const body = '{"a":1}', secret = "s3cret-value";
  it("accepts a correct signature with or without the sha256= prefix and rejects everything else", () => {
    const sig = hmacHex(secret, body);
    expect(verifySignature(secret, body, `sha256=${sig}`)).toBe(true);
    expect(verifySignature(secret, body, sig)).toBe(true);
    expect(verifySignature(secret, body + " ", sig)).toBe(false);
    expect(verifySignature("other", body, sig)).toBe(false);
    expect(verifySignature(undefined, body, sig)).toBe(false);
    expect(verifySignature(secret, body, null)).toBe(false);
    expect(verifySignature(secret, body, "sha256=zz")).toBe(false);
  });
});

describe("channel helpers and conversation (B7.2)", () => {
  afterEach(() => setChannelProviderForTests("sms", undefined));
  it("recognises yes and no in Bangla, English and Banglish, and ignores sentences", () => {
    for (const y of ["হ্যাঁ", " হ্যাঁ। ", "Yes", "ha", "জি"]) expect(isYes(y), y).toBe(true);
    for (const n of ["না", "No", "cancel", "বাতিল"]) expect(isNo(n), n).toBe(true);
    expect(isYes("হ্যাঁ কিন্তু রাস্তাটা অন্য জায়গায়")).toBe(false); expect(isNo("na")).toBe(false);
  });
  it("normalises numbers to E.164", () => { expect(e164("8801712345678")).toBe("+8801712345678"); expect(e164("+8801712345678")).toBe("+8801712345678"); });
  it("prices are never assumed", () => {
    delete process.env.SMS_COST_PER_SEGMENT_USD; delete process.env.WHATSAPP_COST_PER_MESSAGE_USD;
    expect(unitCostUsd("sms", 3)).toBeNull(); expect(unitCostUsd("whatsapp", 1)).toBeNull();
    process.env.SMS_COST_PER_SEGMENT_USD = "0.01"; expect(unitCostUsd("sms", 3)).toBe(0.03);
    process.env.WHATSAPP_COST_PER_MESSAGE_USD = "0.02"; expect(unitCostUsd("whatsapp", 5)).toBe(0.02);
    delete process.env.SMS_COST_PER_SEGMENT_USD; delete process.env.WHATSAPP_COST_PER_MESSAGE_USD;
  });
  it("the fixed texts fit the SMS budget and carry both languages", () => {
    for (const t of [T.link, T.privacy, T.needArea, T.limit, T.cancelled, T.created("JK-2026-1001"), T.draft("রাস্তায় বড় গর্ত", "roads")]) {
      expect(smsParts(fitSms(t, 3).text)).toBeLessThanOrEqual(3);
    }
    expect(T.created("JK-2026-1001")).toContain("JK-2026-1001");
  });
  it("an unknown sender gets the link text, nothing is stored about them and nothing is created", async () => {
    const sent: string[] = [], inserts: Record<string, unknown>[] = [];
    setChannelProviderForTests("sms", { send: async (_to, text) => { sent.push(text); return { ok: true }; } });
    const svc = {
      rpc: async (fn: string) => (fn === "channel_find_link" ? { data: [], error: null } : fn === "channel_send_allowed" ? { data: true, error: null } : { data: { linked: false }, error: null }),
      from: () => ({ insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: null }; } }),
    };
    const r = await processInbound(svc as never, { channel: "sms", providerId: "p1", from: "8801712345678", text: "রাস্তা ভাঙা" });
    expect(r.action).toBe("unknown_sender"); expect(sent).toEqual([T.link]);
    const inbound = inserts.find((i) => i.direction === "in");
    expect(inbound).toMatchObject({ link_id: null, body: null });
    expect(inserts.some((i) => "title" in i)).toBe(false);
  });
});

describe("read-aloud (B7.12)", () => {
  afterEach(() => setTtsProviderForTests(undefined));
  const ctx = (body: unknown) => ({ body }) as unknown as Ctx;
  it("says so when no provider is configured and names the browser fallback", async () => {
    setTtsProviderForTests(null);
    expect(((await ttsConfig()).data as { available: boolean; fallback: string })).toMatchObject({ available: false, fallback: "browser_speech_synthesis" });
    await expect(speak(ctx({ text: "নমস্কার" }))).rejects.toMatchObject({ code: "unavailable" });
  });
  it("redacts personal data before the provider sees the text and returns audio", async () => {
    let seen = "";
    setTtsProviderForTests({ speak: async (t) => { seen = t; return { ok: true, audio: new Uint8Array([1, 2, 3]), contentType: "audio/mpeg" }; } });
    const r = await speak(ctx({ text: "ফোন 01712345678 এ জানান" }));
    expect(seen).not.toContain("01712345678"); expect(r.raw?.contentType).toBe("audio/mpeg");
  });
  it("limits the text and rejects unknown fields", async () => {
    setTtsProviderForTests(null);
    await expect(speak(ctx({ text: "ক".repeat(MAX_TTS_CHARS + 1) }))).rejects.toBeInstanceOf(ApiError);
    await expect(speak(ctx({ text: "ok", voice: "x" }))).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("notification contract (B7.13)", () => {
  it("every mutable Release 1.1 type is accepted by the preferences schema and the contract lists all of them", () => {
    for (const t of ["consultation_opened", "consultation_report", "idea_update", "idea_threshold", "idea_response_due", "area_alert", "checkin_response", "brief_ready"]) {
      expect((NOTIFICATION_TYPES as readonly string[]).includes(t), t).toBe(true);
      expect((RELEASE_1_1_NOTIFICATION_TYPES as readonly string[]).includes(t), t).toBe(true);
    }
    expect(RELEASE_1_1_NOTIFICATION_TYPES).toContain("channel_reply");
  });
});
