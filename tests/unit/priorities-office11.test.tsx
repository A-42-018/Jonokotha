import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import OfficeR11 from "@/components/office/ws/OfficeR11";
import { ToastProvider } from "@/components/ui/Toast";
import PrioritiesOffice from "@/components/office/ws/PrioritiesOffice";
import PrioritiesPanel from "@/components/tracker/PrioritiesPanel";
import { addRank, barWidth, moveRank, removeRank } from "@/lib/priorities-api";
import { exportFilename, fetchExport, narrativeOk } from "@/lib/office-r11-api";
import { json, stub } from "./helpers-r11";

afterEach(() => { vi.unstubAllGlobals(); });

const row = { ref: "PRI-1", constituency_key: "demo-1", title: "কোন কাজ আগে?", description: null, status: "open", closes_at: null, opened_at: "2026-11-01T00:00:00Z", closed_at: null, label: "non_binding" };
const full = { ...row, items: [{ id: "a", position: 1, label: "রাস্তা" }, { id: "b", position: 2, label: "বাতি" }, { id: "c", position: 3, label: "পানি" }, { id: "d", position: 4, label: "স্কুল" }, { id: "e", position: 5, label: "ড্রেন" }, { id: "f", position: 6, label: "হাসপাতাল" }] };

describe("ranking helpers (F7.8)", () => {
  it("keeps at most 5 different needs in order", () => {
    expect(addRank(["a"], "a")).toEqual(["a"]);
    expect(addRank(["a", "b", "c", "d", "e"], "f")).toEqual(["a", "b", "c", "d", "e"]);
    expect(moveRank(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveRank(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveRank(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(removeRank(["a", "b"], "a")).toEqual(["b"]);
    expect(barWidth(10, 20)).toBe(50);
    expect(barWidth(0, 0)).toBe(0);
  });
});

describe("community priorities for citizens", () => {
  it("is always labelled non-binding; a server without the route shows the notice", async () => {
    stub({});
    render(<PrioritiesPanel constituency="demo-1" signedIn loginHref="/login" />);
    expect(screen.getByRole("note")).toHaveTextContent("কোনো সিদ্ধান্ত, বাজেটের ভোট বা প্রতিশ্রুতি নয়");
    expect(await screen.findByRole("heading", { name: "অগ্রাধিকারের পাতা এখনো চালু হয়নি" })).toBeInTheDocument();
  });
  it("lets a person pick up to 5, reorder, and sends the ids in order with PUT", async () => {
    const calls = stub({ "GET /priorities": () => json(200, { data: [row] }), "GET /priorities/PRI-1": () => json(200, { data: full }), "PUT /priorities/PRI-1/ranking": () => json(200, { data: {} }) });
    const u = userEvent.setup();
    render(<PrioritiesPanel constituency="demo-1" signedIn loginHref="/login" />);
    await u.click(await screen.findByRole("button", { name: "যোগ করুন: রাস্তা" }));
    await u.click(screen.getByRole("button", { name: "যোগ করুন: বাতি" }));
    await u.click(screen.getByRole("button", { name: "যোগ করুন: পানি" }));
    await u.click(screen.getByRole("button", { name: "নিচে নিন: রাস্তা" }));
    for (const n of ["স্কুল", "ড্রেন"]) await u.click(screen.getByRole("button", { name: `যোগ করুন: ${n}` }));
    expect(screen.getByRole("button", { name: "যোগ করুন: হাসপাতাল" })).toBeDisabled();
    expect(screen.getByText(/৫টি বাছা হয়ে গেছে/)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "আমার তালিকা পাঠান" }));
    await waitFor(() => expect(calls.find((c) => c.key === "PUT /priorities/PRI-1/ranking")?.body).toEqual({ items: ["b", "a", "c", "d", "e"] }));
    expect(await screen.findByRole("button", { name: "তালিকা বদলে পাঠান" })).toBeInTheDocument();
  });
  it("needs a pick, tells a non-follower to follow the area, and signed-out visitors only get a link", async () => {
    stub({ "GET /priorities": () => json(200, { data: [row] }), "GET /priorities/PRI-1": () => json(200, { data: full }), "PUT /priorities/PRI-1/ranking": () => json(403, { code: "forbidden" }) });
    const u = userEvent.setup();
    const a = render(<PrioritiesPanel constituency="demo-1" signedIn loginHref="/login" />);
    await u.click(await screen.findByRole("button", { name: "আমার তালিকা পাঠান" }));
    expect(await screen.findByText("কমপক্ষে একটি বেছে নিন।")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "যোগ করুন: রাস্তা" }));
    await u.click(screen.getByRole("button", { name: "আমার তালিকা পাঠান" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("আগে এলাকাটির খবর রাখুন");
    a.unmount();
    stub({ "GET /priorities": () => json(200, { data: [row] }), "GET /priorities/PRI-1": () => json(200, { data: full }) });
    render(<PrioritiesPanel constituency="demo-1" signedIn={false} loginHref="/login?next=/priorities" />);
    expect(await screen.findByRole("link", { name: /সাইন ইন/ })).toHaveAttribute("href", "/login?next=/priorities");
    expect(screen.queryByRole("button", { name: /যোগ করুন/ })).toBeNull();
  });
  it("a closed round shows results as points with the scoring rule, only when the server allows", async () => {
    const closed = { ...row, status: "closed" };
    stub({
      "GET /priorities": () => json(200, { data: [closed] }), "GET /priorities/PRI-1": () => json(200, { data: { ...full, status: "closed" } }),
      "GET /priorities/PRI-1/results": () => json(200, { data: { ref: "PRI-1", status: "closed", participants: 12, results_shown: true, items: [{ id: "a", label: "রাস্তা", points: 40, first_choice: 6 }, { id: "b", label: "বাতি", points: 20, first_choice: 2 }] } }),
    });
    const a = render(<PrioritiesPanel constituency="demo-1" signedIn loginHref="/login" />);
    expect(await screen.findByText("১২ জন তালিকা দিয়েছেন")).toBeInTheDocument();
    expect(screen.getByText(/৪০ পয়েন্ট/)).toBeInTheDocument();
    expect(screen.getByText(/প্রথম পছন্দ ৫ পয়েন্ট/)).toBeInTheDocument();
    a.unmount();
    stub({ "GET /priorities": () => json(200, { data: [closed] }), "GET /priorities/PRI-1": () => json(200, { data: { ...full, status: "closed" } }), "GET /priorities/PRI-1/results": () => json(200, { data: { ref: "PRI-1", status: "closed", participants: null, results_shown: false, items: null } }) });
    render(<PrioritiesPanel constituency="demo-1" signedIn loginHref="/login" />);
    expect(await screen.findByText(/কমপক্ষে ৫ জন তালিকা দিলে ফল দেখা যাবে/)).toBeInTheDocument();
  });
});

describe("office priority rounds", () => {
  it("needs 3 to 12 needs, then creates the draft and asks before opening", async () => {
    let status = "draft";
    const calls = stub({
      "GET /office/priorities": () => json(200, { data: [{ ref: "PRI-2", title: "কাজ", status, closes_at: null, created_at: "2026-11-01T00:00:00Z" }] }),
      "POST /office/priorities": () => json(201, { data: { ref: "PRI-2" } }),
      "POST /office/priorities/PRI-2/status": () => { status = "open"; return json(200, { data: {} }); },
    });
    const u = userEvent.setup();
    render(<PrioritiesOffice constituency="demo-1" />);
    await u.type(await screen.findByLabelText(/শিরোনাম/), "এলাকার কাজ");
    await u.type(screen.getByLabelText(/দরকারগুলো/), "রাস্তা{enter}বাতি");
    await u.click(screen.getByRole("button", { name: "খসড়া বানান" }));
    expect(await screen.findByText(/৩ থেকে ১২টি দরকার দিন/)).toBeInTheDocument();
    await u.type(screen.getByLabelText(/দরকারগুলো/), "{enter}পানি");
    await u.click(screen.getByRole("button", { name: "খসড়া বানান" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/priorities")?.body).toEqual({ constituency: "demo-1", title: "এলাকার কাজ", items: ["রাস্তা", "বাতি", "পানি"] }));
    await u.click(await screen.findByRole("button", { name: "চালু করুন" }));
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "চালু করুন" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/priorities/PRI-2/status")?.body).toEqual({ status: "open" }));
  });
});

describe("weekly briefs, exports and indicators for the office", () => {
  const brief = { id: "b1", week_start: "2026-11-09", status: "draft", payload: { received: null, previous_week_received: 12, resolved: 6, top_categories: [{ category: "roads", count: 7 }], hotspot_cells: 1, ideas_awaiting_response: 2, ideas_overdue: 1, consultations_open: 1, commitments_delayed: 0 }, narrative_draft: "এই সপ্তাহে রাস্তা নিয়ে সবচেয়ে বেশি কথা এসেছে।", narrative: null, generated_at: "2026-11-16T00:00:00Z", reviewed_at: null, shared_at: null };
  it("helpers", () => {
    expect(narrativeOk("")).toBe(true);
    expect(narrativeOk("ছোট")).toBe(false);
    expect(narrativeOk("এই সপ্তাহে রাস্তা নিয়ে কথা এসেছে")).toBe(true);
    expect(exportFilename('attachment; filename="jonokotha-demo-1-cases-2026-11-16.csv"', "x.csv")).toBe("jonokotha-demo-1-cases-2026-11-16.csv");
    expect(exportFilename('attachment; filename="../../etc/passwd"', "x.csv")).toBe("x.csv");
    expect(exportFilename(null, "x.csv")).toBe("x.csv");
  });
  it("fetchExport returns the file with its name, and a refusal as an error with the status", async () => {
    const ok = await fetchExport({ kind: "cases", constituency: "demo-1", days: 30, format: "csv" }, (async (url: string) => { expect(url).toContain("kind=cases"); return new Response("a,b", { headers: { "Content-Disposition": 'attachment; filename="r.csv"' } }); }) as unknown as typeof fetch);
    expect(ok.filename).toBe("r.csv");
    await expect(fetchExport({ kind: "ideas", constituency: "demo-1", days: 30, format: "csv" }, (async () => json(403, { code: "forbidden" })) as unknown as typeof fetch)).rejects.toMatchObject({ status: 403 });
  });
  it("a brief shows suppressed numbers as 'under 5', never zero, and approving asks first and sends the fixed text", async () => {
    const calls = stub({
      "GET /office/kpis/release-1-1": () => json(404, { code: "not_found" }),
      "GET /office/briefs": () => json(200, { data: [brief] }),
      "POST /office/briefs/b1/review": () => json(200, { data: {} }),
    });
    const u = userEvent.setup();
    render(<OfficeR11 constituency="demo-1" />);
    expect(await screen.findByText(/এই সপ্তাহে জমা: –/)).toHaveTextContent("৫-এর কম বলে সংখ্যা দেখানো হয়নি");
    expect(screen.getByText("রাস্তাঘাট: ৭")).toBeInTheDocument();
    expect(screen.getByText(/সহায়কের তৈরি/)).toBeInTheDocument();
    const box = screen.getByLabelText(/সারসংক্ষেপের লেখা/);
    await u.clear(box);
    await u.type(box, "এই সপ্তাহে রাস্তা নিয়ে বেশি কথা এসেছে।");
    await u.click(screen.getByRole("button", { name: "অনুমোদন দিন" }));
    expect(calls.some((c) => c.key.endsWith("/review"))).toBe(false);
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "অনুমোদন দিন" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/briefs/b1/review")?.body).toEqual({ decision: "approve", narrative: "এই সপ্তাহে রাস্তা নিয়ে বেশি কথা এসেছে।" }));
  });
  it("downloads a CSV through a link and opens the print page in a new tab", async () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() }));
    const tab = { opener: 1, location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { urls.push(String(url)); return String(url).includes("/exports") ? new Response("﻿a,b", { headers: { "Content-Disposition": 'attachment; filename="r.csv"' } }) : json(404, { code: "not_found" }); }));
    const u = userEvent.setup();
    render(<OfficeR11 constituency="demo-1" />);
    await u.selectOptions(await screen.findByLabelText("কোন তথ্য?"), "ideas");
    await u.click(screen.getByRole("button", { name: "CSV ফাইল নামান" }));
    await waitFor(() => expect(urls.some((x) => x.includes("kind=ideas") && x.includes("format=csv") && x.includes("days=30"))).toBe(true));
    await u.click(screen.getByRole("button", { name: "ছাপার পাতা খুলুন" }));
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");   // opened inside the click
    await waitFor(() => expect(tab.location.href).toBe("blob:x"));
    expect(tab.opener).toBeNull();
  });
  it("a blocked pop-up is explained and nothing is requested; a refused print page closes its empty tab", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { calls.push(String(url)); return json(404, { code: "not_found" }); }));
    vi.spyOn(window, "open").mockReturnValue(null);
    const u = userEvent.setup();
    const a = render(<ToastProvider><OfficeR11 constituency="demo-1" /></ToastProvider>);
    await u.click(await screen.findByRole("button", { name: "ছাপার পাতা খুলুন" }));
    expect(await screen.findByText(/পপ-আপ চালু করে/)).toBeInTheDocument();
    expect(calls.some((x) => x.includes("/exports"))).toBe(false);
    a.unmount();
    const tab = { opener: 1, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/exports") ? json(403, { code: "forbidden" }) : json(404, { code: "not_found" }))));
    render(<ToastProvider><OfficeR11 constituency="demo-1" /></ToastProvider>);
    await u.click(await screen.findByRole("button", { name: "ছাপার পাতা খুলুন" }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
  });
  it("a refused download says so in words", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/exports") ? json(403, { code: "forbidden" }) : json(404, { code: "not_found" }))));
    const u = userEvent.setup();
    render(<ToastProvider><OfficeR11 constituency="demo-1" /></ToastProvider>);
    await u.click(await screen.findByRole("button", { name: "CSV ফাইল নামান" }));
    expect(await screen.findByText("এই প্রতিবেদন নামানোর অনুমতি আপনার নেই।")).toBeInTheDocument();
  });
});
