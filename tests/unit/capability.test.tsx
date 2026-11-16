import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { dataStatusOf, FEATURES, featureStatus, worstStatus } from "@/lib/capability";
import { dict } from "@/lib/i18n";

describe("dataStatusOf", () => {
  it("prefers the server's data_status, then legacy flags, else live", () => {
    expect(dataStatusOf({ data_status: "demo", is_sample: true })).toBe("demo");
    expect(dataStatusOf({ is_sample: true })).toBe("sample");
    expect(dataStatusOf({ sample: true })).toBe("sample");
    expect(dataStatusOf({ is_demo: true })).toBe("demo");
    expect(dataStatusOf({ data_status: "nonsense" })).toBe("live");
    expect(dataStatusOf({})).toBe("live");
    expect(dataStatusOf(null)).toBe("live");
  });
  it("worstStatus picks the least real status in a list", () => {
    expect(worstStatus([{}, { is_sample: true }])).toBe("sample");
    expect(worstStatus([{ is_sample: true }, { data_status: "planned" }, { is_demo: true }])).toBe("planned");
    expect(worstStatus([])).toBe("live");
  });
  it("planned features name the backend item that will switch them on", () => {
    expect(featureStatus("polls")).toBe("planned");
    for (const f of Object.values(FEATURES)) expect(f.backend).toMatch(/^[BM][.0-9]/);
  });
});

describe("CapabilityLabel", () => {
  it("says nothing for live data", () => {
    const { container } = render(<CapabilityLabel status="live" />);
    expect(container).toBeEmptyDOMElement();
  });
  it("shows an icon and text for sample, demo and planned, in Bangla", () => {
    render(<><CapabilityLabel status="sample" /><CapabilityLabel status="demo" /><CapabilityLabel status="planned" /></>);
    expect(screen.getByText(dict.bn.capSample)).toHaveAttribute("title", dict.bn.capSampleHint);
    expect(screen.getByText(dict.bn.capDemo)).toBeInTheDocument();
    expect(screen.getByText(dict.bn.capPlanned)).toHaveAttribute("data-capability", "planned");
  });
  it("uses English when the page is English, and can show live on request", () => {
    document.documentElement.lang = "en";
    render(<><CapabilityLabel status="sample" /><CapabilityLabel status="live" showLive /></>);
    expect(screen.getByText("Sample")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});

describe("PlannedPanel", () => {
  it("is text only: no button, no input and no link unless the caller passes one", () => {
    const { container } = render(<PlannedPanel title="Polls" body="Not yet." />);
    expect(container.querySelectorAll("button, input, select, textarea, a")).toHaveLength(0);
    expect(screen.getByText(dict.bn.capPlanned)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Polls" })).toBeInTheDocument();
  });
});

describe("planned features never look live (F5.13)", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = path.join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = walk(path.join(process.cwd(), "src")).filter((f) => /\.tsx$/.test(f) && !f.includes(`${path.sep}dev${path.sep}`) && !f.endsWith("UiGallery.tsx"));
  it("no source file hard-codes a disabled look-alike button (disabled with no condition)", () => {
    const bad = files.filter((f) => /<button[^>]*\sdisabled(\s|>|\/)/.test(readFileSync(f, "utf8")) || /<button[^>]*aria-disabled="true"/.test(readFileSync(f, "utf8")));
    expect(bad.map((f) => path.basename(f))).toEqual([]);
  });
  it("no screen says coming soon on a control: the label belongs to CapabilityLabel and PlannedPanel", () => {
    const bad = files.filter((f) => /t\.comingSoon/.test(readFileSync(f, "utf8")));
    expect(bad.map((f) => path.basename(f))).toEqual([]);
  });
});
