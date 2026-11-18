import { describe, expect, it } from "vitest";
import { reply } from "@/lib/helper/chat";
import { matchIntent } from "@/lib/helper/intents";
import { search } from "@/lib/helper/kb";
import { guideFor, GUIDES, isPageQuestion } from "@/lib/helper/pagehelp";
import { normalize } from "@/lib/helper/normalize";
import type { Flags } from "@/lib/helper/navigate";

const flags: Flags = { consultations: false, commitments: false, priorities: false, budget: false, budgeting: false, openData: false, mpRecords: false, rti: false, assisted: false };
const ctx = { signedIn: true, flags, loginUrl: (p: string) => `/login?next=${p}` };
const ask = (text: string, o: { voice?: boolean; page?: string; lang?: "bn" | "en"; signedIn?: boolean } = {}) =>
  reply({ messages: [{ role: "user", text }], lang: o.lang ?? "bn", page: o.page ?? "/", voice: o.voice ?? false }, { ...ctx, signedIn: o.signedIn ?? true });
const first = (r: ReturnType<typeof ask>) => (r.blocks.find((b) => b.type === "text") as { text: string } | undefined)?.text ?? "";

describe("Dadu's scripted answers", () => {
  it("greets on an empty start, and on hello", () => {
    expect(ask("").intent).toBe("greet");
    expect(ask("হ্যালো").intent).toBe("greet");
    expect(ask("সালাম").mood).toBe("greet");
  });
  it("emergency words get fixed guidance and nothing else, even by voice", () => {
    for (const t of ["আমি আত্মহত্যা করতে চাই", "he is going to kill me", "ami morte chai"]) {
      const r = ask(t, { voice: true });
      expect(r.source).toBe("emergency");
      expect(r.blocks).toHaveLength(1);
      expect(r.blocks[0]).toMatchObject({ type: "emergency" });
    }
  });
  it("answers the common questions from the site's own wording", () => {
    expect(ask("সমস্যা জানাব কীভাবে?").intent).toBe("report");
    expect(ask("এমপিকে প্রশ্ন করব কীভাবে?").intent).toBe("askmp");
    expect(ask("how do I report a problem", { lang: "en" }).intent).toBe("report");
    expect(ask("পাঠানোর পর কী হয়?").intent).toBe("after");
    expect(ask("আমার তথ্য কি নিরাপদ").intent).toBe("privacy");
    expect(ask("ভাষা বদলাব কীভাবে").intent).toBe("language");
    expect(ask("তথ্য অধিকার কী").intent).toBe("rti");
  });
  it("replies in the language of the question", () => {
    expect(ask("how do I report a problem", { lang: "bn" }).lang).toBe("en");
    expect(ask("সমস্যা জানাব কীভাবে?", { lang: "en" }).lang).toBe("bn");
    expect(first(ask("how do I report a problem", { lang: "bn" }))).toMatch(/^To report/);
  });
  it("land questions get a pointer, not a record lookup or legal advice", () => {
    const r = ask("নামজারি কীভাবে করব");
    expect(r.intent).toBe("land");
    expect(first(r)).toContain("ভূমি অফিস");
    expect(first(r)).toContain("আইনি পরামর্শ দিই না");
    expect(first(ask("who owns khatian 123", { lang: "en" }))).toContain("cannot show anyone's land record");
  });
  it("page help follows the page the person is on", () => {
    const r = ask("এই পাতাটি কীভাবে ব্যবহার করব?", { page: "/polls" });
    expect(r.intent).toBe("page_help");
    expect(first(r)).toContain("পোল");
    expect(first(ask("how do I use this page", { page: "/issue/AB12", lang: "en" }))).toContain("A report");
    expect(first(ask("এই পাতাটি কীভাবে ব্যবহার করব?", { page: "/nowhere" }))).toContain("এই পাতা");
  });
  it("typed chat never moves the page; voice does", () => {
    expect(ask("পোলের পাতায় নিয়ে যাও").blocks.some((b) => b.type === "navigate")).toBe(false);
    const v = ask("পোলের পাতায় নিয়ে যাও", { voice: true });
    expect(v.blocks[0]).toMatchObject({ type: "navigate", href: "/polls" });
    expect(ask("রিপোর্ট করতে চাই", { voice: true, signedIn: false }).blocks[0]).toMatchObject({ type: "navigate", href: "/login?next=/report" });
    expect(ask("রিপোর্ট কীভাবে করব", { voice: true }).blocks.some((b) => b.type === "navigate")).toBe(false);
  });
  it("says it is not sure when nothing matches, and never invents", () => {
    const r = ask("what is the weather in dhaka today", { lang: "en" });
    expect(r.intent).toBe("out_of_scope");
    expect(r.mood).toBe("sorry");
    expect(r.blocks.some((b) => b.type === "handoff")).toBe(true);
    expect(first(r)).toMatch(/not sure/);
  });
  it("only same-site links, and none for pages whose flag is off", () => {
    const links = ["রিপোর্ট", "এমপি", "তথ্য অধিকার কী", "আইডিয়া", "জমির নামজারি"].flatMap((t) => ask(t).blocks.filter((b) => b.type === "link") as { href: string }[]);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l.href).toMatch(/^\/[a-z0-9/-]*$/);
    expect(ask("তথ্য অধিকার কী").blocks.some((b) => b.type === "link" && b.href === "/rti")).toBe(false);
  });
  it("no phone numbers or web addresses in any scripted answer (the emergency numbers are the one fixed exception)", () => {
    for (const t of ["সমস্যা", "এমপি", "জমি", "গোপনীয়তা", "সাহায্য", "জরুরি", "এআই"]) expect(first(ask(t))).not.toMatch(/https?:|www\.|01[3-9]\d{8}/);
  });
});

describe("matching helpers", () => {
  it("intent scores: a clear topic is confident, a social word loses to a topic", () => {
    expect(matchIntent("রিপোর্ট করতে চাই")!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(matchIntent("ধন্যবাদ, রিপোর্ট কীভাবে করব")!.intent.id).toBe("report");
    expect(matchIntent("blah blah")).toBeNull();
  });
  it("KB search finds a page guide for a how question", () => {
    expect(search(normalize("পোল কীভাবে দিতে হয়"))[0]?.entry.id).toMatch(/polls/);
    expect(search("zzz qqq")).toEqual([]);
  });
  it("page questions are recognised, topic questions are not", () => {
    expect(isPageQuestion(normalize("এই পাতাটি কীভাবে ব্যবহার করব?"))).toBe(true);
    expect(isPageQuestion(normalize("how do I use this page"))).toBe(true);
    expect(isPageQuestion(normalize("সমস্যা জানাব কীভাবে?"))).toBe(false);
  });
  it("dynamic routes use their prefix guide", () => {
    expect(guideFor("/issue/AB12?x=1")).toBe(GUIDES["/issue"]);
    expect(guideFor("/ideas/new")).toBe(GUIDES["/ideas/new"]);
    expect(guideFor("/ideas/ID-1")).toBe(GUIDES["/ideas"]);
  });
});
