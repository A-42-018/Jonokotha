import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: () => ({ messages: { create } }) }));
const logged: Record<string, unknown>[] = [];
vi.mock("@/lib/ai/log", () => ({ logAiRun: async (r: Record<string, unknown>) => { logged.push(r); return `run-${logged.length}`; } }));

import { formatNumerals, normalizeDigits, normalizeOtp } from "@/lib/digits";
import { BANGLADESH } from "@/lib/country/bd";
import { adapterFor, registerAdapter, type CountryAdapter } from "@/lib/country";
import { buildSystem, runAgent } from "@/lib/ai/run";
import { glossaryText, glossaryViolations, GLOSSARY } from "@/lib/ai/glossary";
import { IDEA_V1, INTAKE_V2 } from "@/lib/ai/prompts";
import { ideaAssist, ruleQuestions } from "@/lib/ai/idea";
import { translateText } from "@/lib/intake-v2";
import { sniffVideoType } from "@/lib/video";
import { inferDataStatus, recordSecurityEvent } from "@/lib/capabilities";
import { ApiError } from "@/lib/api";
import { isEssential, renderEmail, ESSENTIAL_TYPES } from "@/lib/notify/templates";
import { unsubscribeToken, unsubscribeUrl, verifyUnsubscribe } from "@/lib/notify/unsubscribe";
import { sendVerificationSms, smsDecision } from "@/lib/notify/sms";
import { runJobs, type Handler, type JobKind } from "@/lib/jobs";
import { isProductionEnv, keyPresent } from "@/lib/admin-config";
import { OFFICE_PERMISSIONS } from "@/lib/auth";

beforeEach(() => { logged.length = 0; create.mockReset(); process.env.ANTHROPIC_API_KEY = "test-key"; });
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.CRON_SECRET; delete process.env.UNSUBSCRIBE_SECRET; });
const tool = (input: unknown, name = "t") => ({ content: [{ type: "tool_use", name, input }], stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 } });

describe("digits and numerals (B5.11)", () => {
  it("turns Bangla and Arabic-Indic digits into ASCII and formats numerals back", () => {
    expect(normalizeDigits("০১৭১২৩৪৫৬৭৮")).toBe("01712345678");
    expect(normalizeDigits("٠١٢٣")).toBe("0123");
    expect(normalizeOtp(" ১২৩ - ৪৫৬ ")).toBe("123456");
    expect(formatNumerals(2026, "bn")).toBe("২০২৬");
    expect(formatNumerals("২০২৬", "en")).toBe("2026");
  });
  it("the Bangladesh adapter accepts Bangla digits and common prefixes, and refuses non-mobile numbers", () => {
    for (const p of ["01712345678", "+8801712345678", "8801712345678", "০১৭১২-৩৪৫৬৭৮", "017 1234 5678"]) expect(BANGLADESH.normalizePhone(p), p).toBe("+8801712345678");
    for (const p of ["0121234567", "12345", "+14155550123", ""]) expect(BANGLADESH.normalizePhone(p), p).toBeNull();
  });
});

describe("country adapters (B5.12)", () => {
  it("Bangladesh is configuration; another country plugs in without touching shared code", () => {
    expect(adapterFor("bd")).toBe(BANGLADESH);
    expect(BANGLADESH.adminLevels.map((l) => l.level)).toEqual(["division", "district", "upazila", "city", "union", "ward"]);
    expect(() => adapterFor("NP")).toThrow();
    const nepal: CountryAdapter = { ...BANGLADESH, code: "NP", nameEn: "Nepal", currency: "NPR", normalizePhone: (s) => (/^9\d{9}$/.test(s) ? `+977${s}` : null) };
    registerAdapter(nepal);
    expect(adapterFor("NP").currency).toBe("NPR");
    expect(adapterFor("NP").normalizePhone("9841234567")).toBe("+9779841234567");
  });
});

describe("agents: glossary, caching, simple language, fallbacks (B5.10)", () => {
  it("every system prompt starts with the shared rules and the Bangla glossary as a cacheable prefix; style comes last and uncached", () => {
    for (const p of [IDEA_V1, INTAKE_V2]) {
      const blocks = buildSystem(p);
      expect(blocks[0].text).toContain(glossaryText());
      expect(blocks[0].cache_control).toEqual({ type: "ephemeral" });
      expect(blocks[1].text).toBe(p.system);
      expect(blocks).toHaveLength(2);
    }
    const simple = buildSystem(IDEA_V1, true);
    expect(simple).toHaveLength(3); expect(simple[2].cache_control).toBeUndefined(); expect(simple[2].text).toMatch(/short sentences/);
    expect(simple[0]).toEqual(buildSystem(IDEA_V1)[0]);      // style never changes the cached prefix
  });
  it("sends the system blocks to the model and logs a refusal, a timeout and malformed output with the fallback reason", async () => {
    const S = z.object({ a: z.string() });
    const o = { agent: "idea" as const, prompt: IDEA_V1, tool: { name: "t", description: "d" }, schema: S, input: "x", simpleLanguage: true };
    create.mockResolvedValue(tool({ a: "ok" })); await runAgent(o);
    const sys = create.mock.calls[0][0].system; expect(sys[0].cache_control).toBeTruthy(); expect(sys.at(-1).text).toMatch(/STYLE/);
    create.mockResolvedValue({ ...tool({ a: "x" }), stop_reason: "refusal" }); expect(await runAgent(o)).toMatchObject({ ok: false, reason: "refused" });
    create.mockResolvedValue(tool({ wrong: 1 })); expect(await runAgent(o)).toMatchObject({ ok: false, reason: "invalid_output" });
    create.mockRejectedValue(Object.assign(new Error("Request timed out"), { name: "APIConnectionTimeoutError" })); expect(await runAgent(o)).toMatchObject({ ok: false, reason: "timeout" });
    expect(logged.map((l) => l.status)).toEqual(["ok", "refused", "invalid_output", "timeout"]);
  });
  it("the glossary has no duplicate Bangla terms and flags discouraged words", () => {
    expect(new Set(GLOSSARY.map((g) => g.bn)).size).toBe(GLOSSARY.length);
    expect(glossaryViolations("এই অভিযোগ দেখা হয়েছে")).toEqual(["অভিযোগ (use সমস্যা)"]);
    expect(glossaryViolations("সমস্যাটি দেখা হয়েছে")).toEqual([]);
  });
  it("Idea Assistant suggests with the model, and falls back to rule-based questions in Bangla or English when the model fails", async () => {
    create.mockResolvedValue(tool({ clearer_title: "মাঠে আলো লাগান", questions: ["কোন মাঠ?"], encouragement: "ভালো উদ্যোগ" }, "submit_suggestions"));
    expect(await ideaAssist("আলো", "মাঠে আলো দরকার, ফোন 01712345678")).toMatchObject({ source: "ai", questions: ["কোন মাঠ?"] });
    expect(String(create.mock.calls[0][0].messages[0].content)).not.toContain("01712345678");   // personal data never reaches the model
    create.mockRejectedValue(new Error("boom"));
    const bn = await ideaAssist("আলো", "মাঠে আলো দরকার");
    expect(bn).toMatchObject({ source: "rules", reason: "error" }); expect(bn.questions.length).toBeGreaterThan(0); expect(bn.questions[0]).toMatch(/[ঀ-৿]/);
    const en = ruleQuestions("Light", "We need a light");
    expect(en.questions.some((q) => /Where exactly/.test(q))).toBe(true);
    delete process.env.ANTHROPIC_API_KEY;
    expect((await ideaAssist("Light", "We need a light")).source).toBe("rules");
  });
  it("translation is labelled, keeps the original, skips the model when already in the target language, and says why it failed", async () => {
    create.mockResolvedValue(tool({ translation: "The road is broken" }, "submit_translation"));
    const ok = await translateText("রাস্তা ভাঙা, ফোন 01712345678", "en");
    expect(ok).toMatchObject({ available: true, translation: "The road is broken", target: "en", source: "bn", machine_translated: true, label: "Machine translation" });
    expect(ok.original).toContain("রাস্তা ভাঙা"); expect(ok.original).not.toContain("01712345678");
    create.mockClear();
    expect(await translateText("Hello", "en")).toMatchObject({ available: true, translation: "Hello" }); expect(create).not.toHaveBeenCalled();
    create.mockResolvedValue({ ...tool({}), stop_reason: "refusal" });
    expect(await translateText("রাস্তা", "en")).toMatchObject({ available: false, reason: "refused", original: "রাস্তা" });
  });
});

describe("video evidence (B5.6)", () => {
  const h = (...b: number[]) => new Uint8Array([...b, ...new Array(12 - b.length).fill(0)]);
  it("decides the container by content, not by the declared type", () => {
    expect(sniffVideoType(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]))).toBe("video/mp4");
    expect(sniffVideoType(new Uint8Array([0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]))).toBe("video/quicktime");
    expect(sniffVideoType(h(0x1a, 0x45, 0xdf, 0xa3))).toBe("video/webm");
    expect(sniffVideoType(h(0xff, 0xd8, 0xff))).toBeNull();            // a JPEG renamed .mp4
    expect(sniffVideoType(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
  });
});

describe("capability labels and security events (B5.13, B5.3)", () => {
  it("labels responses live, sample or demo from the records themselves", () => {
    expect(inferDataStatus({ ref: "x" })).toBe("live");
    expect(inferDataStatus([{ is_sample: false }, { is_sample: true }])).toBe("sample");
    expect(inferDataStatus({ is_demo: true })).toBe("demo");
    expect(inferDataStatus(null)).toBe("live");
    expect(inferDataStatus("text")).toBe("live");
  });
  it("records rate-limit, auth, permission and cross-site events with a salted hash of the IP, and never throws", async () => {
    const rpc = vi.fn().mockResolvedValue({});
    const sb = { rpc } as never;
    await recordSecurityEvent(sb, new ApiError("rate_limited", "x"), "GET /a", "203.0.113.9");
    await recordSecurityEvent(sb, new ApiError("forbidden", "x", { _: "cross_site" }), "POST /a", "203.0.113.9");
    await recordSecurityEvent(sb, new ApiError("not_found", "x"), "GET /a", "203.0.113.9");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map((c) => c[1].p_kind)).toEqual(["rate_limit", "csrf_blocked"]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("203.0.113.9");
    await expect(recordSecurityEvent({ rpc: () => { throw new Error("db down"); } } as never, new ApiError("forbidden", "x"), "r", "1.1.1.1")).resolves.toBeUndefined();
    await expect(recordSecurityEvent(null, new ApiError("forbidden", "x"), "r", "1.1.1.1")).resolves.toBeUndefined();
  });
  it("reports whether an integration key is present without reading its value, and blocks demo tools in production", () => {
    expect(keyPresent("anthropic", { ANTHROPIC_API_KEY: "sk-secret" } as never)).toBe(true);
    expect(keyPresent("anthropic", {} as never)).toBe(false);
    expect(keyPresent("maplibre", {} as never)).toBeNull();
    expect(keyPresent("stt", { STT_API_KEY: "x" } as never)).toBe(true);        // aliases count
    expect(isProductionEnv({ APP_ENV: "production" } as never)).toBe(true);
    expect(isProductionEnv({ VERCEL_ENV: "production" } as never)).toBe(true);
    expect(isProductionEnv({ VERCEL_ENV: "preview" } as never)).toBe(false);
  });
});

describe("notifications: templates, unsubscribe, SMS (B5.9)", () => {
  it("renders Bangla first, then English, with the generic title only; unsubscribe link only for non-essential types", () => {
    const base = { title: "আপনার এলাকার জন্য নতুন ঘোষণা", body: "নম্বর AN-1", en: { title: "New announcement", body: "Reference AN-1" }, appUrl: "https://app.example" };
    const e = renderEmail({ ...base, type: "announcement", unsubscribeUrl: "https://app.example/u?x=1" });
    expect(e.subject).toBe(base.title);
    expect(e.text.indexOf("আপনার")).toBeLessThan(e.text.indexOf("New announcement"));
    expect(e.text).toContain("https://app.example/u?x=1");
    expect(renderEmail({ ...base, type: "issue_status", unsubscribeUrl: "https://app.example/u?x=1" }).text).not.toContain("/u?x=1");
  });
  it("essential types match the database list and can never be unsubscribed; links are signed", () => {
    expect(ESSENTIAL_TYPES.every(isEssential)).toBe(true); expect(isEssential("announcement")).toBe(false);
    expect(unsubscribeUrl("https://a", "u1", "announcement")).toBeUndefined();         // no secret configured
    process.env.UNSUBSCRIBE_SECRET = "a-long-secret-value-123";
    const t = unsubscribeToken("u1", "announcement");
    expect(verifyUnsubscribe("u1", "announcement", t)).toBe(true);
    expect(verifyUnsubscribe("u2", "announcement", t)).toBe(false);
    expect(verifyUnsubscribe("u1", "new_in_area", t)).toBe(false);
    expect(verifyUnsubscribe("u1", "issue_status", unsubscribeToken("u1", "issue_status"))).toBe(false);   // essential
    expect(verifyUnsubscribe("u1", "announcement", t.slice(0, -2) + "xx")).toBe(false);
    expect(unsubscribeUrl("https://a", "u1", "issue_status")).toBeUndefined();
    expect(unsubscribeUrl("https://a", "u1", "announcement")).toContain(`t=${t}`);
  });
  it("SMS is only for verification, only with consent, only within budget, and only when a provider is configured", async () => {
    const gate = { consentGranted: true, sentThisMonth: 0, monthlyBudget: 100 };
    expect(smsDecision({ ...gate, purpose: "announcement", configured: true })).toEqual({ allowed: false, reason: "purpose_not_allowed" });
    expect(smsDecision({ ...gate, purpose: "verification", configured: false })).toEqual({ allowed: false, reason: "not_configured" });
    expect(smsDecision({ ...gate, consentGranted: false, purpose: "verification", configured: true })).toEqual({ allowed: false, reason: "no_consent" });
    expect(smsDecision({ ...gate, sentThisMonth: 100, purpose: "verification", configured: true })).toEqual({ allowed: false, reason: "budget_exhausted" });
    const send = vi.fn().mockResolvedValue({ ok: true });
    expect(await sendVerificationSms({ send }, "+8801712345678", "123456", gate)).toEqual({ allowed: true, sent: true });
    expect(send.mock.calls[0][1]).toMatch(/123456/);
    expect(await sendVerificationSms(null, "+8801712345678", "123456", gate)).toEqual({ allowed: false, reason: "not_configured" });
    expect(await sendVerificationSms({ send }, "+8801712345678", "1", { ...gate, consentGranted: false })).toEqual({ allowed: false, reason: "no_consent" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("background job runner (B5.8)", () => {
  function fakeDb(jobs: { id: string; kind: JobKind; payload: object; attempts: number; max_attempts: number }[]) {
    const finished: Record<string, [boolean, string | null]> = {};
    const rpc = vi.fn(async (fn: string, a: Record<string, unknown>) => {
      if (fn === "ensure_periodic_jobs") return { data: 0 };
      if (fn === "claim_jobs") return { data: jobs };
      if (fn === "finish_job") { finished[a.p_id as string] = [a.p_ok as boolean, a.p_error as string | null]; const j = jobs.find((x) => x.id === a.p_id)!; return { data: a.p_ok ? "done" : j.attempts >= j.max_attempts ? "dead" : "failed" }; }
      return { data: null };
    });
    return { sb: { rpc } as never, finished, rpc };
  }
  it("runs due jobs, retries a failing one and dead-letters it after the last attempt; one bad job never stops the rest", async () => {
    const { sb, finished } = fakeDb([
      { id: "a", kind: "poll_maintenance", payload: {}, attempts: 1, max_attempts: 5 },
      { id: "b", kind: "ingest", payload: {}, attempts: 1, max_attempts: 5 },
      { id: "c", kind: "purge", payload: {}, attempts: 5, max_attempts: 5 },
      { id: "d", kind: "ai_task", payload: {}, attempts: 1, max_attempts: 5 },
    ]);
    const ok: Handler = async () => ({});
    const boom: Handler = async () => { throw new Error("provider down"); };
    const r = await runJobs(sb, 10, "test", { poll_maintenance: ok, ingest: boom, purge: boom });
    expect(r).toEqual({ claimed: 4, done: 1, failed: 2, dead: 1 });
    expect(finished.a).toEqual([true, null]); expect(finished.b[1]).toBe("provider down"); expect(finished.d[1]).toBe("no handler for kind");
  });
});

describe("permission matrix mirror (B5.1)", () => {
  it("the MP can approve and delegate; the office manager can delegate but not approve; the liaison and case officer can do neither", () => {
    expect(OFFICE_PERMISSIONS.mp.approve).toEqual({ assignedOnly: false }); expect(OFFICE_PERMISSIONS.mp.delegate).toBeTruthy();
    expect(OFFICE_PERMISSIONS.office_manager.delegate).toBeTruthy(); expect(OFFICE_PERMISSIONS.office_manager.approve).toBeUndefined();
    for (const r of ["case_officer", "agency_liaison"] as const) { expect(OFFICE_PERMISSIONS[r].approve).toBeUndefined(); expect(OFFICE_PERMISSIONS[r].delegate).toBeUndefined(); }
  });
});

describe("Sentry for server and proxy (B5.8)", () => {
  it("sends only the error class, a trimmed message and the route; nothing from headers or bodies; does nothing without a DSN", async () => {
    const { onRequestError } = await import("@/instrumentation");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const ctx = { routerKind: "App Router", routePath: "/api/v1/issues", routeType: "route", renderSource: undefined, revalidateReason: undefined, renderType: undefined } as never;
    const req = { path: "/api/v1/issues?token=secret", method: "POST", headers: { cookie: "sb=SESSION", authorization: "Bearer SECRET" } };
    delete process.env.SENTRY_DSN;
    await onRequestError(new Error("boom"), req, ctx);
    expect(fetchSpy).not.toHaveBeenCalled();
    process.env.SENTRY_DSN = "https://abc123@o1.ingest.sentry.io/42";
    await onRequestError(Object.assign(new Error("boom with detail"), { digest: "d1g3st" }), req, ctx);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://o1.ingest.sentry.io/api/42/envelope/");
    const body = String(init.body);
    expect(body).toContain("boom with detail"); expect(body).toContain("route:/api/v1/issues"); expect(body).toContain("d1g3st");
    expect(body).not.toMatch(/SESSION|SECRET|cookie|authorization|token=/);
    delete process.env.SENTRY_DSN; fetchSpy.mockRestore();
  });
});
