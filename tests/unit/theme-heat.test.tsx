import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThemePanel from "@/components/me/ThemePanel";
import ThemeApplier from "@/components/ui/ThemeApplier";
import HeatPanel from "@/components/explore/HeatPanel";
import { emergingCount, heatGeoJson, type Heatmap } from "@/lib/heatmap-api";
import { cleanTheme, resolveTheme } from "@/lib/theme";

let dark = true;
vi.mock("@/lib/flags-more", () => ({ FLAGS: { consultations: false, commitments: false, priorities: false, surveys: false, officeRelease11: false, channels: false, readAloud: false, get darkMode() { return dark; } } }));

beforeEach(() => { dark = true; delete document.documentElement.dataset.theme; });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); delete document.documentElement.dataset.theme; });

/** ThemeApplier reads the build flag when it runs, so each test sets the environment first. */
const applier = (flag: boolean) => { vi.stubEnv("NEXT_PUBLIC_FLAG_DARK_MODE", flag ? "1" : "0"); vi.stubEnv("NEXT_PUBLIC_FLAG_RELEASE11", "0"); return ThemeApplier; };

function stubMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("dark") ? matches : false, addEventListener: (_e: string, f: () => void) => listeners.add(f), removeEventListener: (_e: string, f: () => void) => listeners.delete(f) }));
  return listeners;
}

describe("dark mode (F7.10)", () => {
  it("resolves the choice: 'system' follows the phone, the others do not", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(cleanTheme("neon")).toBe("system");
  });
  it("puts data-theme on <html> from the saved choice, and does nothing at all when the flag is off", async () => {
    stubMedia(false);
    localStorage.setItem("jonokotha:theme:v1", JSON.stringify("dark"));
    const On = applier(true);
    const a = render(<On />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    a.unmount();
    delete document.documentElement.dataset.theme;
    const Off = applier(false);
    render(<Off />);
    await new Promise((r) => setTimeout(r, 30));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
  it("'follow the phone' is dark when the phone is dark and light otherwise", async () => {
    stubMedia(true);
    const On = applier(true);
    const a = render(<On />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    a.unmount();
    delete document.documentElement.dataset.theme;
    stubMedia(false);
    const b = render(<On />);
    await new Promise((r) => setTimeout(r, 30));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    b.unmount();
  });
  it("Settings offers the three choices with the right one checked, saves the pick, and the page follows", async () => {
    stubMedia(false);
    const u = userEvent.setup();
    const On = applier(true);
    render(<><On /><ThemePanel /></>);
    expect(screen.getByRole("radio", { name: /ফোনের মতো/ })).toBeChecked();
    await u.click(screen.getByRole("radio", { name: "গাঢ়" }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(JSON.parse(localStorage.getItem("jonokotha:theme:v1")!)).toBe("dark");
    expect(await screen.findByText("এখন দেখাচ্ছে: গাঢ়")).toBeInTheDocument();
    await u.click(screen.getByRole("radio", { name: "হালকা" }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBeUndefined());
  });
  it("shows nothing in Settings when the flag is off", () => {
    dark = false;
    const { container } = render(<ThemePanel />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("density layer text alternative (F7.10)", () => {
  const data: Heatmap = { cells: [{ lat: 23.8, lng: 90.4, count: 14, top_category: "roads", previous_period_count: null, emerging: true }, { lat: 23.81, lng: 90.41, count: 6, top_category: null, previous_period_count: 6, emerging: false }], cells_hidden: 3, min_group_size: 5, cell_size_m: 1000, period_days: 30, category: null, generated_at: "2026-11-17T00:00:00Z", definition: "x" };
  it("builds map points only from real positions and counts emerging cells", () => {
    expect(heatGeoJson(data.cells).features).toHaveLength(2);
    expect(heatGeoJson([{ ...data.cells[0], lat: NaN }]).features).toHaveLength(0);
    expect(emergingCount(data.cells)).toBe(1);
  });
  it("lists the dense squares in words, says how many were hidden, and says it is not a ranking", () => {
    render(<HeatPanel data={data} on setOn={() => {}} />);
    expect(screen.getByText(/১৪টি সমস্যা, বেশির ভাগ রাস্তাঘাট/)).toBeInTheDocument();
    expect(screen.getByText("নতুন করে বাড়ছে", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/আরও ৩টি ঘরে ৫টির কম সমস্যা/)).toBeInTheDocument();
    expect(screen.getByText(/কোনো এলাকার র‍্যাংক নয়/)).toBeInTheDocument();
  });
  it("the switch changes the layer and an empty result says so", async () => {
    const set = vi.fn();
    const u = userEvent.setup();
    const a = render(<HeatPanel data={data} on={false} setOn={set} />);
    await u.click(screen.getByRole("checkbox"));
    expect(set).toHaveBeenCalledWith(true);
    a.unmount();
    render(<HeatPanel data={{ ...data, cells: [], cells_hidden: 0 }} on setOn={() => {}} />);
    expect(screen.getByText("এখন ৫টি বা তার বেশি সমস্যার মতো কোনো ঘর নেই।")).toBeInTheDocument();
  });
});
