import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QueryProvider from "@/components/QueryProvider";
import OfficeKpis from "@/components/office/OfficeKpis";
import MetricNote from "@/components/ui/MetricNote";
import { dict } from "@/lib/i18n";
import { OFFICE_KPI_KEYS, PUBLIC_METRICS, metricHref } from "@/lib/metrics";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("metric definitions", () => {
  it("every public metric has a name, a definition, a limit and a period description in both languages", () => {
    for (const lang of ["bn", "en"] as const) {
      const d = dict[lang] as Record<string, unknown>;
      for (const m of PUBLIC_METRICS) {
        for (const k of [`mx_${m.id}`, `mx_${m.id}_def`, `mx_${m.id}_limit`, m.window]) expect(typeof d[k] === "string" && (d[k] as string).length > 5, `${lang} ${k}`).toBe(true);
      }
    }
  });
  it("names every office KPI the server sends", () => {
    for (const k of OFFICE_KPI_KEYS) expect(typeof (dict.en as Record<string, unknown>)[`mxOffice_${k}`]).toBe("string");
  });
  it("links to an anchor that exists", () => {
    expect(metricHref("median")).toBe("/metrics#median");
    expect(PUBLIC_METRICS.map((m) => m.id)).toContain("median");
  });
});

describe("MetricNote", () => {
  it("shows the period, the update time and a how-calculated link", () => {
    render(<MetricNote id="affected" period="since sent" updated="2026-11-16T05:00:00Z" />);
    expect(screen.getByText(new RegExp(`${t.mxPeriod}: since sent`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t.mxUpdated))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.mxHow })).toHaveAttribute("href", "/metrics#affected");
  });
});

describe("OfficeKpis", () => {
  const data = {
    constituency: "demo-1", is_sample: true, period_days: 30, generated_at: "2026-11-16T05:00:00Z", min_group_size: 5,
    metrics: {
      received: { value: null, suppressed: true, definition: "Issues submitted in the period" },
      unassigned_workload: { value: 7, definition: "Open issues with no assigned officer right now" },
      median_hours_to_first_response: { value: 26.5, suppressed: false, definition: "Median hours" },
      handling_time_with_copilot: { with_hours: 4, without_hours: null, definition: "Association, not proof" },
      ai_acceptance: { value: [{ agent: "copilot", suggestions: 12, accepted_or_edited_pct: 75, suppressed: false }, { agent: "routing", suggestions: null, accepted_or_edited_pct: null, suppressed: true }], definition: "Per agent" },
    },
  };
  const wrap = () => render(<QueryProvider><OfficeKpis constituency="demo-1" /></QueryProvider>);

  it("shows each metric with its definition, hides small groups instead of showing zero, and never ranks", async () => {
    const f = vi.fn(async (..._a: unknown[]) => json(200, { data }));
    vi.stubGlobal("fetch", f);
    wrap();
    expect(await screen.findByText(t.mxOffice_unassigned_workload)).toBeInTheDocument();
    expect(String(f.mock.calls[0][0])).toBe("/api/v1/office/kpis?constituency=demo-1&days=30");
    const received = screen.getByRole("heading", { name: t.mxOffice_received }).closest("li")!;
    expect(within(received).getByText(t.mxOfficeHidden)).toBeInTheDocument();
    expect(within(received).getByText("Issues submitted in the period")).toBeInTheDocument();
    expect(screen.getByText(/Association, not proof/)).toBeInTheDocument();
    expect(screen.getByText(t.mxOfficeAssoc)).toBeInTheDocument();
    expect(screen.getAllByText(t.mxNoRank).length).toBeGreaterThan(0);
  });
  it("says so when the person may not see the indicators", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(403, { code: "forbidden" })));
    wrap();
    expect(await screen.findByText(t.mxOfficeNo)).toBeInTheDocument();
  });
});
