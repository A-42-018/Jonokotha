import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SiteFooter from "@/components/SiteFooter";
import MainShell from "@/components/ui/MainShell";
import About from "@/app/about/page";
import Accessibility from "@/app/accessibility/page";
import Terms from "@/app/terms/page";
import { dict } from "@/lib/i18n";

let lang: "bn" | "en" = "bn";
vi.mock("@/lib/i18n", async (orig) => ({ ...(await orig<typeof import("@/lib/i18n")>()), getLang: async () => lang }));
vi.mock("next/navigation", () => ({ usePathname: () => "/about", useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => { lang = "bn"; });

describe("footer on every page", () => {
  it.each(["bn", "en"] as const)("says in %s that it is not an emergency service nor an official channel, with all the links", (l) => {
    const t = dict[l];
    render(<SiteFooter t={t} />);
    const foot = screen.getByRole("contentinfo");
    expect(within(foot).getByText(t.footEmergencyHead)).toBeInTheDocument();
    expect(foot.textContent).toContain("999".replace(/9/g, l === "bn" ? "৯" : "9"));
    expect(within(foot).getByText(t.footOfficialHead)).toBeInTheDocument();
    const hrefs = within(screen.getByRole("navigation", { name: t.footNav })).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/about", "/help", "/privacy", "/terms", "/accessibility", "/help#emergency", "/settings"]);
  });
  it("the page shell puts the footer inside the main area, after the content", () => {
    render(<MainShell footer={<SiteFooter t={dict.bn} />}><p>body</p></MainShell>);
    const main = screen.getByRole("main");
    expect(main.lastElementChild?.tagName).toBe("FOOTER");
  });
});

describe("About, Terms and accessibility pages", () => {
  it.each(["bn", "en"] as const)("About in %s has one heading, what it is not, AI and data notes, and no invented contact", async (l) => {
    lang = l;
    const t = dict[l];
    render(await About());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t.abTitle);
    for (const h of [t.abDoTitle, t.abNotTitle, t.abAiTitle, t.abDataTitle, t.abContactTitle]) expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    expect(screen.getByText(t.abNot1)).toBeInTheDocument();
    expect(screen.getByText(t.abContactNone)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@/ })).toBeNull();
  });
  it("Terms starts with the emergency note and links to About", async () => {
    render(await Terms());
    expect(screen.getByRole("note")).toHaveTextContent(dict.bn.tmEmergency);
    expect(screen.getByRole("link", { name: dict.bn.tmAbout })).toHaveAttribute("href", "/about");
  });
  it("accessibility statement states the target, what is open (including the device check), and a date", async () => {
    render(await Accessibility());
    expect(screen.getByText(dict.bn.a11yStandard)).toBeInTheDocument();
    expect(screen.getByText(dict.bn.a11yOpen5)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(dict.bn.a11yUpdated))).toBeInTheDocument();
    expect(screen.getByText(dict.bn.a11yContactNone)).toBeInTheDocument();
  });
});
