import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SurveysPanel from "@/components/citizen/SurveysPanel";
import PollsOffice from "@/components/office/ws/PollsOffice";
import { missingAnswers, satisfactionView } from "@/lib/surveys-api";
import { json, stub } from "./helpers-r11";

afterEach(() => { vi.unstubAllGlobals(); });

const row = { ref: "SV-1", constituency_key: "demo-1", title: "রাস্তার কাজ কেমন?", description: null, status: "open", closes_at: null, opened_at: "2026-11-01T00:00:00Z", closed_at: null };
const qs = [{ id: "11111111-1111-4111-8111-111111111111", position: 1, kind: "rating", prompt: "কাজ কেমন?", options: null }, { id: "22222222-2222-4222-8222-222222222222", position: 2, kind: "choice", prompt: "কোনটা আগে?", options: ["রাস্তা", "বাতি"] }];

describe("survey helpers (F7.6)", () => {
  it("every question must be answered, and a satisfaction figure appears only from 5 ratings", () => {
    expect(missingAnswers(qs as never, { [qs[0].id]: 4 })).toEqual([qs[1].id]);
    expect(missingAnswers(qs as never, { [qs[0].id]: 4, [qs[1].id]: "বাতি" })).toEqual([]);
    expect(satisfactionView({ days: 90, ratings: null, suppressed: true, average: null, distribution: null })).toBeNull();
    expect(satisfactionView({ days: 90, ratings: 4, suppressed: false, average: 4.2, distribution: null })).toBeNull();
    expect(satisfactionView({ days: 90, ratings: 12, suppressed: false, average: 3.456, distribution: { "5": 7, "1": 5 } })).toEqual({ average: 3.5, n: 12, dist: [["1", 5], ["5", 7]] });
  });
});

describe("surveys for citizens", () => {
  it("a server without surveys says so and offers nothing to press", async () => {
    stub({});
    render(<SurveysPanel signedIn loginHref="/login" constituency="demo-1" />);
    expect(await screen.findByText("এই সুবিধা এখনো চালু হয়নি")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("needs every answer, then sends rating as a number and choice as text, once", async () => {
    const calls = stub({
      "GET /surveys": () => json(200, { data: [row] }),
      "GET /surveys/SV-1": () => json(200, { data: { ...row, questions: qs } }),
      "GET /analytics/satisfaction": () => json(200, { data: { days: 90, ratings: null, suppressed: true, average: null, distribution: null } }),
      "POST /surveys/SV-1/responses": () => json(201, { data: {} }),
    });
    const u = userEvent.setup();
    render(<SurveysPanel signedIn loginHref="/login" constituency="demo-1" />);
    await u.click(await screen.findByRole("radio", { name: "৪ নম্বর" }));
    await u.click(screen.getByRole("button", { name: "উত্তর পাঠান" }));
    expect(await screen.findByText("সব প্রশ্নের উত্তর দিন।")).toBeInTheDocument();
    expect(calls.some((c) => c.key.startsWith("POST"))).toBe(false);
    await u.click(screen.getByRole("radio", { name: "বাতি" }));
    await u.click(screen.getByRole("button", { name: "উত্তর পাঠান" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /surveys/SV-1/responses")?.body).toEqual({ answers: { [qs[0].id]: 4, [qs[1].id]: "বাতি" } }));
    expect(await screen.findByText("ধন্যবাদ। আপনার উত্তর পাঠানো হয়েছে।", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("এখনো যথেষ্ট নম্বর জমেনি। ৫টির কম হলে গড় দেখানো হয় না।")).toBeInTheDocument();
  });
  it("signed-out visitors get a sign-in link; an answered survey says so; a closed one shows results only when allowed", async () => {
    stub({
      "GET /surveys": () => json(200, { data: [row, { ...row, ref: "SV-2", title: "পুরনো সার্ভে", status: "closed" }] }),
      "GET /surveys/SV-1": () => json(200, { data: { ...row, questions: qs } }),
      "GET /surveys/SV-2": () => json(200, { data: { ...row, ref: "SV-2", status: "closed", questions: qs } }),
      "GET /surveys/SV-2/results": () => json(200, { data: { ref: "SV-2", respondents: 9, results_shown: true, questions: [{ id: qs[0].id, position: 1, kind: "rating", prompt: "কাজ কেমন?", average: 3.46, counts: {} }] } }),
      "GET /analytics/satisfaction": () => json(200, { data: { days: 90, ratings: 12, suppressed: false, average: 4.15, distribution: { "4": 8, "5": 4 } } }),
    });
    render(<SurveysPanel signedIn={false} loginHref="/login?next=/polls" constituency="demo-1" />);
    expect(await screen.findByRole("link", { name: /সাইন ইন/ })).toHaveAttribute("href", "/login?next=/polls");
    expect(await screen.findByText("৯ জন উত্তর দিয়েছেন")).toBeInTheDocument();
    expect(screen.getByText("গড় ৩.৫ (৫-এর মধ্যে)")).toBeInTheDocument();
    expect(await screen.findByText(/১২টি নম্বরের ভিত্তিতে/)).toBeInTheDocument();
    expect(screen.getByText(/কোনো প্রতিনিধির র‍্যাংক নয়/)).toBeInTheDocument();
  });
  it("a second response (409) is explained", async () => {
    stub({
      "GET /surveys": () => json(200, { data: [row] }), "GET /surveys/SV-1": () => json(200, { data: { ...row, questions: [qs[0]] } }), "GET /analytics/satisfaction": () => json(404, { code: "not_found" }),
      "POST /surveys/SV-1/responses": () => json(409, { code: "conflict", field_errors: { _: "already_answered" } }),
    });
    const u = userEvent.setup();
    render(<SurveysPanel signedIn loginHref="/login" constituency="demo-1" />);
    await u.click(await screen.findByRole("radio", { name: "৫ নম্বর" }));
    await u.click(screen.getByRole("button", { name: "উত্তর পাঠান" }));
    expect(await screen.findByText("আপনি এই সার্ভেতে আগেই উত্তর দিয়েছেন।", { selector: "[role=status], p" })).toBeInTheDocument();
  });
});

describe("office polls and surveys", () => {
  it("a server without the routes shows the notice and no form", async () => {
    stub({});
    render(<PollsOffice constituency="demo-1" surveys={false} />);
    expect(await screen.findByText(/সার্ভারে এখনও নেই/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "খসড়া বানান" })).toBeNull();
  });
  it("checks the poll form, creates a draft, and asks before opening it", async () => {
    const day = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    let status = "draft";
    const calls = stub({
      "GET /office/polls": () => json(200, { data: [{ ref: "PL-9", question: "কোন কাজ আগে?", status, results_visibility: "after_close", closes_at: null, created_at: "2026-11-01T00:00:00Z" }] }),
      "POST /office/polls": () => json(201, { data: { ref: "PL-9", status: "draft" } }),
      "POST /office/polls/PL-9/publish": () => { status = "open"; return json(200, { data: { ref: "PL-9", status: "open" } }); },
    });
    const u = userEvent.setup();
    render(<PollsOffice constituency="demo-1" surveys={false} />);
    await u.click(await screen.findByRole("button", { name: "খসড়া বানান" }));
    expect(await screen.findByText("প্রশ্ন ৫ থেকে ২০০ অক্ষরের হতে হবে।")).toBeInTheDocument();
    await u.type(screen.getByLabelText("প্রশ্ন (৫ থেকে ২০০ অক্ষর)"), "কোন কাজ আগে?");
    await u.type(screen.getByLabelText(/পছন্দগুলো/), "রাস্তা{enter}বাতি");
    await u.type(screen.getByLabelText(/শেষ হওয়ার তারিখ/), day);
    await u.click(screen.getByRole("button", { name: "খসড়া বানান" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/polls")?.body).toEqual({ constituency: "demo-1", question: "কোন কাজ আগে?", options: ["রাস্তা", "বাতি"], results_visibility: "after_close", closes_at: `${day}T23:59:00+06:00` }));
    await u.click(await screen.findByRole("button", { name: "চালু করুন" }));
    expect(calls.some((c) => c.key.endsWith("/publish"))).toBe(false);
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "চালু করুন" }));
    await waitFor(() => expect(calls.some((c) => c.key === "POST /office/polls/PL-9/publish")).toBe(true));
  });
  it("a survey needs a title and valid questions, and sends rating and choice questions", async () => {
    const calls = stub({
      "GET /office/polls": () => json(200, { data: [] }), "GET /office/surveys": () => json(200, { data: [] }),
      "POST /office/surveys": () => json(201, { data: { ref: "SV-3" } }),
    });
    const u = userEvent.setup();
    render(<PollsOffice constituency="demo-1" surveys />);
    const form = (await screen.findByRole("heading", { name: "নতুন সার্ভে" })).closest("form") as HTMLElement;
    await u.click(within(form).getByRole("button", { name: "খসড়া বানান" }));
    expect(await within(form).findByText("শিরোনাম ৫ থেকে ১৫০ অক্ষরের হতে হবে।")).toBeInTheDocument();
    await u.type(within(form).getByLabelText(/শিরোনাম/), "রাস্তার কাজ কেমন?");
    await u.type(within(form).getByLabelText("প্রশ্ন ১"), "কাজ কেমন হয়েছে?");
    await u.click(within(form).getByRole("button", { name: "বাছাইয়ের প্রশ্ন যোগ করুন" }));
    await u.type(within(form).getByLabelText("প্রশ্ন ২"), "কোনটা আগে করবেন?");
    await u.type(within(form).getByLabelText(/পছন্দগুলো/), "রাস্তা{enter}বাতি");
    await u.click(within(form).getByRole("button", { name: "খসড়া বানান" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/surveys")?.body).toEqual({ constituency: "demo-1", title: "রাস্তার কাজ কেমন?", questions: [{ kind: "rating", prompt: "কাজ কেমন হয়েছে?" }, { kind: "choice", prompt: "কোনটা আগে করবেন?", options: ["রাস্তা", "বাতি"] }] }));
  });
});
