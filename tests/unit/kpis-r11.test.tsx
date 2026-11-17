import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OfficeR11 from "@/components/office/ws/OfficeR11";
import { KPI_ORDER, RATE_KPIS } from "@/lib/office-r11-api";
import { json } from "./helpers-r11";

afterEach(() => { vi.unstubAllGlobals(); });

const kp = (value: number | null, extra: object = {}) => ({ value, definition: "Definition in English.", ...extra });
const kpis = {
  constituency: "demo-1", period_days: 90, generated_at: "2026-11-17T00:00:00Z", min_group_size: 5,
  kpis: {
    consultation_participants: kp(null, { suppressed: true }), consultation_report_rate: kp(0.5, { n: 4 }), idea_threshold_on_time: kp(0.75, { n: 8, reached: 9 }), project_checkins: kp(12),
    priority_participants: kp(null, { suppressed: true }), survey_responses: kp(30), channel_intake_share: kp(null, { n: null }), satisfaction_average: kp(4.26, { n: 14 }), area_alerts_sent: kp(0), commitments_delivered: kp(0.4, { n: 5 }),
  },
};
function stubAll(kpiRes: () => Response) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/office/kpis/release-1-1") ? kpiRes() : json(404, { code: "not_found" }))));
}

describe("Release 1.1 indicators in office analytics (F7.12)", () => {
  it("shows all ten with their definitions; rates as percent, small groups as 'under 5', never as zero", async () => {
    stubAll(() => json(200, { data: kpis }));
    render(<OfficeR11 constituency="demo-1" />);
    expect(await screen.findByRole("heading", { name: "রিলিজ ১.১ সূচক" })).toBeInTheDocument();
    await screen.findByRole("heading", { name: "ফলাফল প্রকাশ হওয়া মতামত-পাতা" });
    expect(KPI_ORDER).toHaveLength(10);
    const card = (name: string) => screen.getByRole("heading", { name }).closest("div") as HTMLElement;
    expect(within(card("ফলাফল প্রকাশ হওয়া মতামত-পাতা")).getByText("৫০%")).toBeInTheDocument();
    expect(within(card("ফলাফল প্রকাশ হওয়া মতামত-পাতা")).getByText("৪-এর মধ্যে")).toBeInTheDocument();
    expect(within(card("সময়মতো উত্তর পাওয়া আইডিয়া")).getByText("৭৫%")).toBeInTheDocument();
    expect(within(card("মতামতে অংশ নেওয়া মানুষ")).getByText("৫-এর কম বলে দেখানো হয়নি")).toBeInTheDocument();
    expect(within(card("মতামতে অংশ নেওয়া মানুষ")).queryByText("০")).toBeNull();
    expect(within(card("মেসেজে আসা সমস্যার ভাগ")).getByText("এখনো এর হিসাব করার মতো তথ্য নেই")).toBeInTheDocument();
    expect(within(card("সমাধানের পর গড় নম্বর")).getByText("৪.৩")).toBeInTheDocument();
    expect(within(card("পাঠানো এলাকার সতর্কবার্তা")).getByText("০")).toBeInTheDocument();   // a real count of zero is shown as zero
    expect(screen.getAllByText("সংজ্ঞা")).toHaveLength(10);
    expect(RATE_KPIS).toContain("commitments_delivered");
  });
  it("a refusal says the person may not see them; a server without the route says not switched on", async () => {
    stubAll(() => json(403, { code: "forbidden" }));
    const a = render(<OfficeR11 constituency="demo-1" />);
    expect(await screen.findByText("এই সূচক দেখার অনুমতি আপনার নেই।")).toBeInTheDocument();
    a.unmount();
    stubAll(() => json(404, { code: "not_found" }));
    render(<OfficeR11 constituency="demo-1" />);
    expect(await screen.findByRole("heading", { name: "এই সূচকগুলো এখনো চালু হয়নি" })).toBeInTheDocument();
  });
});
