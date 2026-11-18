import { describe, expect, it } from "vitest";
import { navigateTo, offered, PAGES, toTarget, type Flags } from "@/lib/helper/navigate";

const off: Flags = { consultations: false, commitments: false, priorities: false, budget: false, budgeting: false, openData: false, mpRecords: false, rti: false, assisted: false };
const on: Flags = { consultations: true, commitments: true, priorities: true, budget: true, budgeting: true, openData: true, mpRecords: true, rti: true, assisted: true };
const slug = (t: string, f: Flags = off) => navigateTo(t, f)?.slug ?? null;

describe("voice navigation: opens a page", () => {
  it.each([
    ["রিপোর্ট করতে চাই", "report"], ["সমস্যা জানাতে চাই", "report"], ["রিপোর্টের পাতায় নিয়ে যাও", "report"], ["I want to report", "report"], ["ripor korte chai", "report"], ["take me to report", "report"],
    ["পোলের পাতা খোলো", "polls"], ["open polls", "polls"], ["পোল দেখাও", "polls"],
    ["আমার সমস্যাগুলো দেখাও", "me"], ["আমার রিপোর্ট খোলো", "me"],
    ["এমপিকে প্রশ্ন করতে চাই", "ask"], ["এমপির কাছে প্রশ্ন করতে চাই", "ask"], ["আমার এমপি খুঁজতে চাই", "mp"], ["এমপি খোঁজার পাতায় যাও", "mp"],
    ["নতুন আইডিয়া দিতে চাই", "ideaNew"], ["আইডিয়ার পাতায় নিয়ে যাও", "ideas"], ["প্রকল্প দেখাও", "projects"], ["প্রথম পাতায় যাও", "home"], ["go home", "home"],
    ["সাহায্যের পাতায় নিয়ে যাও", "help"], ["যোগাযোগের পাতা খোলো", "contact"], ["গোপনীয়তা নীতি খোলো", "privacy"], ["সেটিংস খোলো", "settings"], ["ভাষা বদলাতে চাই", "settings"], ["নোটিফিকেশন দেখাও", "notifications"],
    ["জনকথা সম্পর্কে দেখাও", "about"], ["সবার ব্যবহারের সুবিধা খোলো", "accessibility"],
  ])("%s -> %s", (t, s) => expect(slug(t)).toBe(s));

  it("Bangla digits and endings do not matter", () => {
    expect(slug("পোলে যেতে চাই")).toBe("polls");
    expect(slug("রিপোর্টে যাও")).toBe("report");
  });
});

describe("voice navigation: questions are answered, not navigated", () => {
  it.each(["রিপোর্ট কীভাবে করব?", "পোল কী?", "এমপি কে?", "how do I report a problem", "what is the polls page", "কেন রিপোর্ট করব", "সমস্যা জানাতে কত সময় লাগে", "where is the report page"])("%s", (t) => expect(slug(t)).toBeNull());
  it("a page name alone is not enough", () => {
    expect(slug("পোল")).toBeNull();
    expect(slug("আইডিয়া")).toBeNull();
  });
});

describe("voice navigation: flags and sign-in", () => {
  it("never offers a page whose flag is off", () => {
    expect(slug("তথ্য অধিকারের পাতায় যাও", off)).toBeNull();
    expect(slug("তথ্য অধিকারের পাতায় যাও", on)).toBe("rti");
    expect(slug("বাজেট দেখাও", off)).toBeNull();
    expect(slug("বাজেট দেখাও", on)).toBe("budget");
    expect(offered(off).every((p) => !p.flag)).toBe(true);
  });
  it("a signed-out person is sent to sign in, then on", () => {
    const p = navigateTo("রিপোর্ট করতে চাই", off)!;
    const out = toTarget(p, "bn", false, (x) => `/login?need=1&next=${encodeURIComponent(x)}`);
    expect(out.href).toBe("/login?need=1&next=%2Freport");
    expect(out.say).toContain("সাইন ইন");
    expect(toTarget(p, "bn", true, (x) => x).href).toBe("/report");
  });
  it("only fixed, same-site hrefs; no staff, admin or developer pages", () => {
    for (const p of PAGES) { expect(p.href).toMatch(/^\/[a-z0-9/-]*$/); expect(p.href).not.toMatch(/^\/(office|admin|dev|api)/); }
    expect(slug("admin পাতায় যাও", on)).toBeNull();
  });
});
