import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { addWorkingDays, buildRtiDraft, DEFAULT_RTI_RULES, rtiTimeline } from "../../src/lib/release2/rti";
import { evaluativeWords } from "../../src/lib/release2/mp-neutral";
import { parsePublicKey, receiptMessage, signatureHash, verifyReceipt } from "../../src/lib/release2/receipt";
import { toXml } from "../../src/lib/open311";
import { VOLUNTEER_RULES } from "../../src/lib/release2";

describe("RTI helper (B8.7)", () => {
  const input = { agency_name: "Roads and Highways Department", subject: "Repair budget", info_requested: "Please give the amounts spent on the market road.", period: "2025-26", format: "electronic" as const, language: "bn" as const };
  it("drafts carry placeholders for the applicant's own details and never contain any", () => {
    const bn = buildRtiDraft(input);
    expect(bn).toContain("[আপনার নাম লিখুন]"); expect(bn).toContain("[আপনার ঠিকানা লিখুন]"); expect(bn).toContain("তথ্য অধিকার আইন, ২০০৯"); expect(bn).toContain("2025-26");
    const en = buildRtiDraft({ ...input, language: "en", format: "inspection", period: null });
    expect(en).toContain("[write your name]"); expect(en).toContain("inspection of the records"); expect(en).not.toContain("Period concerned");
  });
  it("working days skip Friday and Saturday and the start day is day 0 (earliest date, holidays unknown)", () => {
    expect(addWorkingDays("2026-11-15", 1)).toBe("2026-11-16");       // Sunday -> Monday
    expect(addWorkingDays("2026-11-19", 1)).toBe("2026-11-22");       // Thursday -> Sunday (skips Fri, Sat)
    expect(addWorkingDays("2026-11-15", 20)).toBe("2026-12-13");
    expect(addWorkingDays("2026-11-15", 0)).toBe("2026-11-15");
  });
  it("the timeline is self-reported and moves from awaiting to past the earliest deadline", () => {
    expect(rtiTimeline({ status: "draft", filed_on: null, answered_on: null }, DEFAULT_RTI_RULES).state).toBe("not_filed");
    expect(rtiTimeline({ status: "filed_by_me", filed_on: "2026-11-15", answered_on: null }, DEFAULT_RTI_RULES, "2026-11-20")).toMatchObject({ state: "awaiting_answer", earliest_due_on: "2026-12-13", self_reported: true });
    expect(rtiTimeline({ status: "filed_by_me", filed_on: "2026-11-15", answered_on: null }, DEFAULT_RTI_RULES, "2026-12-11").state).toBe("due_soon");
    expect(rtiTimeline({ status: "filed_by_me", filed_on: "2026-11-15", answered_on: null }, DEFAULT_RTI_RULES, "2026-12-14").state).toBe("past_earliest_deadline");
    expect(rtiTimeline({ status: "answered", filed_on: "2026-11-15", answered_on: "2026-12-01" }, DEFAULT_RTI_RULES, "2026-12-30").state).toBe("answered");
    expect(DEFAULT_RTI_RULES.reviewed).toBe(false);
  });
});

describe("MP record neutrality guard (B8.8)", () => {
  it("flags evaluative words in Bangla and English and passes plain description", () => {
    expect(evaluativeWords("The member asked the ministry about road funds for 12 districts.")).toEqual([]);
    expect(evaluativeWords("সদস্য সড়ক বরাদ্দ নিয়ে মন্ত্রণালয়ের কাছে প্রশ্ন করেছেন।")).toEqual([]);
    expect(evaluativeWords("This was the best and most active member")).toEqual(expect.arrayContaining(["best", "active"]));
    expect(evaluativeWords("সদস্য অত্যন্ত খারাপ প্রশ্ন করেছেন")).toContain("খারাপ");
    expect(evaluativeWords("The ranking of members")).toContain("ranking");
    expect(evaluativeWords("The goodwill visit")).toEqual([]);   // whole words only
  });
});

describe("agency receipts (B8.2)", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const r = { integration_id: "i", referral_id: "r", agency_reference: "AG-1", issued_at: "2026-11-17T00:00:00.000Z" };
  it("verifies a signature over the fixed message and nothing else", () => {
    const sig = sign(null, Buffer.from(receiptMessage(r)), privateKey).toString("base64");
    expect(verifyReceipt(pem, receiptMessage(r), sig)).toBe(true);
    expect(verifyReceipt(pem, receiptMessage({ ...r, referral_id: "other" }), sig), "bound to the referral").toBe(false);
    expect(verifyReceipt(pem, receiptMessage({ ...r, agency_reference: "AG-2" }), sig), "bound to the reference").toBe(false);
    expect(verifyReceipt(pem, receiptMessage(r), "AAAA"), "garbage").toBe(false);
    expect(verifyReceipt("not a key", receiptMessage(r), sig)).toBe(false);
    expect(parsePublicKey(pem).fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(() => parsePublicKey(generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "pem" }).toString())).toThrow();
    expect(signatureHash(sig)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Open311 XML (B8.9)", () => {
  it("escapes values and renders nulls as empty elements", () => {
    const x = toXml("service_requests", "request", [{ service_request_id: "JK-1", description: "a < b & \"c\"", media_url: null, n: 3 }]);
    expect(x).toBe('<?xml version="1.0" encoding="utf-8"?><service_requests><request><service_request_id>JK-1</service_request_id><description>a &lt; b &amp; &quot;c&quot;</description><media_url></media_url><n>3</n></request></service_requests>');
  });
});

describe("volunteer rules (B8.3)", () => {
  it("are version-stamped drafts, in both languages, with five conduct points", () => {
    expect(VOLUNTEER_RULES.reviewed).toBe(false);
    expect(VOLUNTEER_RULES.conduct.bn).toHaveLength(5); expect(VOLUNTEER_RULES.conduct.en).toHaveLength(5);
    expect(VOLUNTEER_RULES.consent.bn).toMatch(/অ্যাকাউন্ট/); expect(VOLUNTEER_RULES.consent.en).toMatch(/no account/);
  });
});
