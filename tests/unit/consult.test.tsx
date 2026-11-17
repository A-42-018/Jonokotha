import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConsultationReport from "@/components/consult/ConsultationReport";
import ConsultationView from "@/components/consult/ConsultationView";
import ConsultationsList from "@/components/consult/ConsultationsList";
import ConsultationsOffice from "@/components/consult/ConsultationsOffice";
import { answered, closesAtFromDay, groupName, lines, nextStatement, type VoteKind } from "@/lib/consult-api";
import { writeProblem } from "@/lib/r11";
import { ApiError } from "@/lib/api-client";
import { json, stub } from "./helpers-r11";

afterEach(() => { vi.unstubAllGlobals(); });

const st = (id: string, text: string, my: VoteKind | null = null) => ({ id, text, kind: "seed", my_vote: my });
const consultation = (over: object = {}) => ({ ref: "CN-1", question: "এই ওয়ার্ডে আগে কোন কাজ দরকার?", description: null, status: "open", closes_at: "2026-12-30T10:00:00Z", statement_count: 2, participant_count: null, statements: [st("s1", "রাস্তা আগে"), st("s2", "বাতি আগে")], next_statement_id: "s1", ...over });

describe("consultation helpers (F7.1)", () => {
  it("picks the next unanswered statement and counts answers", () => {
    const c = { statements: [st("a", "x", "agree"), st("b", "y"), st("c", "z")], next_statement_id: null as string | null };
    expect(nextStatement(c)?.statement.id).toBe("b");
    expect(answered(c)).toBe(1);
    expect(nextStatement({ statements: [st("a", "x", "pass")], next_statement_id: null })).toBeNull();
  });
  it("group names, input lines and the closing time", () => {
    expect(groupName("A", "bn")).toBe("ক");
    expect(groupName("B", "en")).toBe("B");
    expect(lines(" a \n\n b\n", 10)).toEqual(["a", "b"]);
    expect(lines("1\n2\n3", 2)).toEqual(["1", "2"]);
    expect(closesAtFromDay("2026-12-30")).toBe("2026-12-30T23:59:00+06:00");
  });
  it("write problems are read from the server code", () => {
    expect(writeProblem(new ApiError("x", 409, { _: "consultation_closed" }))).toBe("closed");
    expect(writeProblem(new ApiError("x", 422, { _: "statement_limit" }))).toBe("limit");
    expect(writeProblem(new ApiError("x", 409, { _: "duplicate" }))).toBe("duplicate");
    expect(writeProblem(new ApiError("x", 401))).toBe("auth");
    expect(writeProblem(new ApiError("x", 0))).toBe("fail");
  });
});

describe("consultations list", () => {
  it("a server without the routes shows the not-switched-on panel and no link", async () => {
    stub({});
    render(<ConsultationsList constituency="demo-1" />);
    expect(await screen.findByRole("heading", { name: /চালু হয়নি/ })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("lists a consultation with counts, hides a small group's number, and opens it", async () => {
    stub({ "GET /consultations": () => json(200, { data: [{ ref: "CN-1", question: "কোন কাজ আগে?", description: null, status: "open", closes_at: null, statement_count: 4, participant_count: null }] }) });
    render(<ConsultationsList constituency="demo-1" />);
    expect(await screen.findByText("কোন কাজ আগে?")).toBeInTheDocument();
    expect(screen.getByText(/৫ জনের কম/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "মতামত দিন" })).toHaveAttribute("href", "/consultations/CN-1");
  });
  it("empty list and error with retry", async () => {
    stub({ "GET /consultations": () => json(200, { data: [] }) });
    const { unmount } = render(<ConsultationsList constituency="demo-1" />);
    expect(await screen.findByText("এই তালিকায় এখন কিছু নেই।")).toBeInTheDocument();
    unmount();
    stub({ "GET /consultations": () => json(500, { code: "internal_error" }) });
    render(<ConsultationsList constituency="demo-1" />);
    expect(await screen.findByRole("alert", {}, { timeout: 9000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "আবার চেষ্টা করুন" })).toBeInTheDocument();
  });
});

describe("answering a consultation", () => {
  it("shows one statement at a time, sends a vote, then the next; no counts are shown", async () => {
    let voted = false;
    const calls = stub({
      "GET /consultations/CN-1": () => json(200, { data: consultation(voted ? { statements: [st("s1", "রাস্তা আগে", "agree"), st("s2", "বাতি আগে")], next_statement_id: "s2" } : {}) }),
      "PUT /consultations/CN-1/statements/s1/vote": () => { voted = true; return json(200, { data: {} }); },
    });
    const u = userEvent.setup();
    render(<ConsultationView refId="CN-1" signedIn loginHref="/login" />);
    expect(await screen.findByTestId("statement")).toHaveTextContent("রাস্তা আগে");
    expect(screen.queryByText("বাতি আগে")).toBeNull();
    await u.click(screen.getByRole("button", { name: "একমত" }));
    await waitFor(() => expect(screen.getByTestId("statement")).toHaveTextContent("বাতি আগে"));
    expect(calls.find((c) => c.key.startsWith("PUT"))?.body).toEqual({ vote: "agree" });
    expect(screen.queryByText(/%/)).toBeNull();
    // change an answer while open
    await u.click(screen.getByRole("button", { name: "আমার উত্তর বদলান" }));
    const mine = screen.getByText("রাস্তা আগে").closest("li") as HTMLElement;
    expect(within(mine).getByRole("button", { name: "একমত" })).toHaveAttribute("aria-pressed", "true");
  });
  it("when every statement is answered it says so and offers the add form; a statement goes to review", async () => {
    const calls = stub({
      "GET /consultations/CN-1": () => json(200, { data: consultation({ statements: [st("s1", "রাস্তা আগে", "agree")], next_statement_id: null }) }),
      "POST /consultations/CN-1/statements": () => json(201, { data: {} }),
    });
    const u = userEvent.setup();
    render(<ConsultationView refId="CN-1" signedIn loginHref="/login" />);
    expect(await screen.findByText("সবগুলোতে উত্তর দেওয়া হয়ে গেছে")).toBeInTheDocument();
    await u.type(screen.getByLabelText("আপনার বাক্য"), "ab");
    await u.click(screen.getByRole("button", { name: "পাঠান" }));
    expect(await screen.findByText("কমপক্ষে ৫ অক্ষর লিখুন।")).toBeInTheDocument();
    await u.type(screen.getByLabelText("আপনার বাক্য"), "cde fgh");
    await u.click(screen.getByRole("button", { name: "পাঠান" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /consultations/CN-1/statements")?.body).toEqual({ text: "abcde fgh" }));
  });
  it("signed-out visitors get a sign-in link, closed and reported states have no vote buttons, 404 is not found", async () => {
    stub({ "GET /consultations/CN-1": () => json(200, { data: consultation() }) });
    const a = render(<ConsultationView refId="CN-1" signedIn={false} loginHref="/login?next=x" />);
    expect(await screen.findByRole("link", { name: "সাইন ইন করুন" })).toHaveAttribute("href", "/login?next=x");
    expect(screen.queryByRole("button", { name: "একমত" })).toBeNull();
    a.unmount();
    stub({ "GET /consultations/CN-1": () => json(200, { data: consultation({ status: "reported" }) }) });
    const b = render(<ConsultationView refId="CN-1" signedIn loginHref="/login" />);
    expect(await screen.findByRole("link", { name: "ফলাফল দেখুন" })).toHaveAttribute("href", "/consultations/CN-1/report");
    b.unmount();
    stub({});
    render(<ConsultationView refId="CN-9" signedIn loginHref="/login" />);
    expect(await screen.findByText("এই মতামত-পাতা পাওয়া যায়নি")).toBeInTheDocument();
  });
});

describe("you said, we did report", () => {
  const report = {
    consultation_ref: "CN-1", participants: 12, hidden_groups: 1, summary_bn: "রাস্তা নিয়ে বেশির ভাগ একমত।", you_said_we_did: "রাস্তার কাজ শুরু হয়েছে।", actions: [{ text: "বাতি বসানো হবে" }], published_at: "2026-12-30T10:00:00Z",
    groups: [{ group: "A", size: 7 }],
    agreement: [
      { statement_id: "s1", text: "রাস্তা আগে", votes: 12, agree_pct: 75, disagree_pct: 17, pass_pct: 8, groups: [{ group: "A", votes: 7, agree_pct: 80 }, { group: "B", votes: 0, agree_pct: null }], pattern: "common_ground" },
      { statement_id: "s2", text: "বাতি আগে", votes: null, agree_pct: null, disagree_pct: null, pass_pct: null, groups: [], pattern: null },
    ],
  };
  it("shows aggregates, groups with the hidden-group note, and never a number for a small statement", async () => {
    stub({ "GET /consultations/CN-1/report": () => json(200, { data: report }) });
    render(<ConsultationReport refId="CN-1" />);
    expect(await screen.findByText("রাস্তা নিয়ে বেশির ভাগ একমত।")).toBeInTheDocument();
    expect(screen.getByText("রাস্তার কাজ শুরু হয়েছে।")).toBeInTheDocument();
    expect(screen.getByText("সব দলই কাছাকাছি একমত")).toBeInTheDocument();
    expect(screen.getByText(/৭৫% একমত/)).toBeInTheDocument();
    expect(screen.getByText(/দল ক: ৮০% একমত/)).toBeInTheDocument();
    expect(screen.getByText(/ছোট দল ৫ জনের কম বলে দেখানো হয়নি/)).toBeInTheDocument();
    const small = screen.getByText("বাতি আগে").closest("div") as HTMLElement;
    expect(within(small).getByText(/উত্তর ৫টির কম/)).toBeInTheDocument();
    expect(within(small).queryByText(/%/)).toBeNull();
  });
  it("no published report is an empty state, not an error", async () => {
    stub({});
    render(<ConsultationReport refId="CN-1" />);
    expect(await screen.findByText("এখনো কোনো ফলাফল প্রকাশ হয়নি")).toBeInTheDocument();
  });
});

describe("office consultations", () => {
  it("a server without the routes shows the panel with no form", async () => {
    stub({});
    render(<ConsultationsOffice constituency="demo-1" />);
    expect(await screen.findByRole("heading", { name: /চালু হয়নি/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "খসড়া বানান" })).toBeNull();
  });
  it("checks the form first, then creates a draft with the seed lines and an end-of-day Dhaka closing time", async () => {
    const day = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const calls = stub({
      "GET /office/consultations": () => json(200, { data: [] }),
      "POST /office/consultations": () => json(201, { data: { ref: "CN-7", status: "draft" } }),
      "GET /office/consultations/CN-7": () => json(200, { data: { ref: "CN-7", status: "draft", question: "কোন কাজ আগে দরকার?", description: null, closes_at: null, participants: null, participants_suppressed: true, statements: [{ id: "x", text: "রাস্তা আগে", kind: "seed", status: "pending_review", reason: null }], report: null } }),
    });
    const u = userEvent.setup();
    render(<ConsultationsOffice constituency="demo-1" />);
    await u.click(await screen.findByRole("button", { name: "খসড়া বানান" }));
    expect(await screen.findByText(/১০ থেকে ২০০ অক্ষর/, { selector: "p" })).toBeInTheDocument();
    expect(calls.some((c) => c.key === "POST /office/consultations")).toBe(false);
    await u.type(screen.getByLabelText("প্রশ্ন"), "কোন কাজ আগে দরকার?");
    await u.type(screen.getByLabelText(/শুরুর বাক্য/), "রাস্তা আগে{enter}বাতি আগে");
    await u.type(screen.getByLabelText("শেষ হওয়ার তারিখ"), day);
    await u.click(screen.getByRole("button", { name: "খসড়া বানান" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/consultations")?.body).toMatchObject({ constituency: "demo-1", seed_statements: ["রাস্তা আগে", "বাতি আগে"], closes_at: `${day}T23:59:00+06:00` }));
    // the draft opens: a statement waiting for review can be approved, and opening needs two approved statements
    expect(await screen.findByRole("button", { name: "অনুমোদন করুন" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "মতামত চালু করুন" })).toBeNull();
    expect(screen.getByText("চালু করতে কমপক্ষে ২টি অনুমোদিত বাক্য লাগে।")).toBeInTheDocument();
  });
  it("publishing needs a closed consultation, a long enough text and a confirm", async () => {
    const detail = (status: string) => ({ ref: "CN-7", status, question: "কোন কাজ আগে দরকার?", description: null, closes_at: null, participants: 12, participants_suppressed: false, statements: [], report: { status: "draft", participants: 12, groups: [], agreement: [], hidden_groups: 0, ai_summary: null, summary_bn: "রাস্তা নিয়ে সবাই একমত।", you_said_we_did: null, actions: [], published_at: null } });
    const calls = stub({
      "GET /office/consultations": () => json(200, { data: [{ ref: "CN-7", question: "কোন কাজ আগে দরকার?", status: "closed", closes_at: null }] }),
      "GET /office/consultations/CN-7": () => json(200, { data: detail("closed") }),
      "PUT /office/consultations/CN-7/report": () => json(200, { data: {} }),
    });
    const u = userEvent.setup();
    render(<ConsultationsOffice constituency="demo-1" />);
    await u.click(await screen.findByRole("button", { name: "দেখুন ও চালান" }));
    const publish = await screen.findByRole("button", { name: "প্রকাশ করুন" });
    expect(publish).toBeDisabled();
    await u.type(screen.getByLabelText(/আপনারা বললেন/), "রাস্তার কাজ শুরু হয়েছে, বাতি বসবে।");
    expect(publish).toBeEnabled();
    await u.click(publish);
    expect(calls.some((c) => c.key === "PUT /office/consultations/CN-7/report")).toBe(false);
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "প্রকাশ করুন" }));
    await waitFor(() => expect(calls.find((c) => c.key === "PUT /office/consultations/CN-7/report")?.body).toMatchObject({ publish: true, summary_bn: "রাস্তা নিয়ে সবাই একমত।" }));
  });
});
