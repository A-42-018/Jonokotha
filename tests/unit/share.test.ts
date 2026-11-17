import { describe, expect, it } from "vitest";
import { issueMetadata, shareLinks } from "@/lib/share";

describe("share", () => {
  it("builds encoded WhatsApp and Facebook links for a same-site path", () => {
    const l = shareLinks("https://jonokotha.example", "/issue/JK-1", "দেখুন");
    expect(l.url).toBe("https://jonokotha.example/issue/JK-1");
    expect(l.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent("দেখুন https://jonokotha.example/issue/JK-1")}`);
    expect(l.facebook).toContain(encodeURIComponent("https://jonokotha.example/issue/JK-1"));
  });
  it("issue metadata carries title, category and area only", () => {
    const m = issueMetadata({ ref: "JK-1", title: "গর্ত", area: "ওয়ার্ড ৩" }, "রাস্তা", "https://x.example", "জনকথা");
    expect(m.description).toBe("রাস্তা · ওয়ার্ড ৩");
    expect(m.openGraph.images[0].url).toBe("/illustrations/share-image.png");
    expect(JSON.stringify(m)).not.toMatch(/description":"[^"]*[Rr]eporter/);
  });
  it("omits the area separator when there is no area", () => {
    expect(issueMetadata({ ref: "a", title: "t", area: "" }, "রাস্তা", "https://x.example", "জ").description).toBe("রাস্তা");
  });
});
