import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import AnnouncementComposer from "@/components/office/AnnouncementComposer";
import Copilot from "@/components/office/Copilot";
import NotesAndAssign from "@/components/office/NotesAndAssign";
import { ToastProvider } from "@/components/ui/Toast";
import { dict } from "@/lib/i18n";
import { currentAssignee, splitNotes } from "@/lib/office-api";
import type { CaseRecord } from "@/lib/types";

const t = dict.bn;
type Call = [string, RequestInit | undefined];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const calls = (f: ReturnType<typeof vi.fn>) => f.mock.calls as unknown as Call[];
const c: CaseRecord = { ref: "JK-1", title: "গর্ত", category: "roads", description: "বাজারের সামনে বড় গর্ত আছে, তিন দিন ধরে।", area: "ওয়ার্ড ৩", constituencyId: "demo-1", status: "received", createdAt: "2026-11-01T00:00:00Z", timeline: [], ai: { summary: "", similarRefs: [], agencyId: "a", confidence: 0.5 } };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

describe("office helpers", () => {
  it("separates internal notes from public replies and finds the current assignee", () => {
    const ev = (o: object) => ({ event_type: "note", from_status: null, to_status: null, public_message: null, internal_note: null, is_public: false, created_at: String(Math.random()), ...o });
    const { internal, publicReplies } = splitNotes([ev({ internal_note: "গোপন" }), ev({ public_message: "দেখছি", is_public: true }), ev({ event_type: "status_change", to_status: "acknowledged" })]);
    expect(internal.map((e) => e.internal_note)).toEqual(["গোপন"]);
    expect(publicReplies.map((e) => e.public_message)).toEqual(["দেখছি"]);
    expect(currentAssignee([{ assigned_to: "a", assigned_at: "1", unassigned_at: "2", reason: null }, { assigned_to: "b", assigned_at: "3", unassigned_at: null, reason: null }])).toBe("b");
  });
});

describe("NotesAndAssign", () => {
  const detail = { ref: "JK-1", events: [{ event_type: "note", from_status: null, to_status: null, public_message: null, internal_note: "পুরনো নোট", is_public: false, created_at: "2026-11-02T00:00:00Z" }], assignments: [] };
  const router = () => vi.fn(async (url: string) => {
    if (url.endsWith("/me/profile")) return json(200, { data: { id: "me-1" } });
    if (url.endsWith("/office/issues/JK-1")) return json(200, { data: detail });
    return json(200, { data: {} });
  });

  it("lists real notes, adds an internal note privately, and asks before posting a public reply", async () => {
    const user = userEvent.setup();
    const f = router();
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><NotesAndAssign cref="JK-1" /></ToastProvider>);
    expect(await screen.findByText("পুরনো নোট")).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.cpNoteLabel), "নতুন গোপন নোট");
    await user.click(screen.getByRole("button", { name: t.cpNoteAdd }));
    await vi.waitFor(() => expect(calls(f).some((x) => x[0].endsWith("/update"))).toBe(true));
    expect(JSON.parse(calls(f).find((x) => x[0].endsWith("/update"))![1]!.body as string)).toEqual({ note: "নতুন গোপন নোট", public: false });

    await user.type(screen.getByLabelText(t.cpReplyLabel), "আমরা বিষয়টি দেখছি।");
    await user.click(screen.getByRole("button", { name: t.cpReplySend }));
    expect(calls(f).filter((x) => x[0].endsWith("/update")).length).toBe(1); // nothing public before the confirm step
    await user.click(screen.getAllByRole("button", { name: t.cpReplySend, hidden: true }).at(-1)!);
    await vi.waitFor(() => expect(calls(f).filter((x) => x[0].endsWith("/update")).length).toBe(2));
    expect(JSON.parse(calls(f).filter((x) => x[0].endsWith("/update"))[1][1]!.body as string)).toEqual({ note: "আমরা বিষয়টি দেখছি।", public: true });
    vi.unstubAllGlobals();
  });

  it("assign to me posts my own id", async () => {
    const user = userEvent.setup();
    const f = router();
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><NotesAndAssign cref="JK-1" /></ToastProvider>);
    const btn = await screen.findByRole("button", { name: t.cpAssignMe });
    await vi.waitFor(() => expect(btn).not.toBeDisabled());
    await user.click(btn);
    await vi.waitFor(() => expect(calls(f).some((x) => x[0].endsWith("/assign"))).toBe(true));
    expect(JSON.parse(calls(f).find((x) => x[0].endsWith("/assign"))![1]!.body as string)).toEqual({ assignee: "me-1" });
    vi.unstubAllGlobals();
  });
});

describe("Copilot", () => {
  it("fetches suggestions on request, shows the cited facts and a fallback label, and sends Accept to the decision endpoint", async () => {
    const user = userEvent.setup();
    const sug = (type: string, payload: object) => ({ id: `id-${type}`, type, payload: { ...payload, source: "fallback" }, citations: [{ fact: "F1", label: "title" }], confidence: null });
    const f = vi.fn(async (url: string) => {
      if (url.endsWith("/copilot")) return json(200, { data: { source: "fallback", suggestions: [sug("summary", { text: "সংক্ষেপ: গর্ত" }), sug("missing_information", { items: [{ bn: "একটি ছবি" }] }), sug("reply_draft", { text: "আপনার সমস্যাটি আমরা পেয়েছি।" })] } });
      if (url.endsWith("/routing")) return json(200, { data: { available: true, suggestion: null, reason: "no_confident_match" } });
      if (url.endsWith("/duplicates")) return json(200, { data: { available: true, candidates: [{ suggestion_id: "dup-1", ref: "JK-9", score: 0.9, reasons: {} }] } });
      if (url.includes("/decision")) return json(200, { data: { id: "id-summary", decision: "accepted" } });
      return json(404, { code: "not_found" });
    });
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><Copilot c={c} /></ToastProvider>);
    expect(screen.queryByRole("button", { name: t.cpAccept })).toBeNull(); // nothing to decide before suggestions exist
    await user.click(screen.getByRole("button", { name: t.cpGet }));
    expect(await screen.findByText("সংক্ষেপ: গর্ত")).toBeInTheDocument();
    expect(screen.getByText(t.cpFallback)).toBeInTheDocument();
    expect(screen.getByText("একটি ছবি")).toBeInTheDocument();
    expect(screen.getByText("JK-9")).toBeInTheDocument();
    expect(screen.getByText(t.cpNoRouting)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: t.cpAccept })[0]);
    await vi.waitFor(() => expect(calls(f).some((x) => x[0].includes("/ai/suggestions/id-summary/decision"))).toBe(true));
    expect(JSON.parse(calls(f).find((x) => x[0].includes("/decision"))![1]!.body as string)).toEqual({ decision: "accept" });
    vi.unstubAllGlobals();
  });

  it("says so when AI suggestions are not configured", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => json(503, { code: "unavailable" })));
    render(<ToastProvider><Copilot c={c} /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: t.cpGet }));
    expect(await screen.findByText(t.cpUnavailable)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe("AnnouncementComposer", () => {
  it("previews, confirms, then publishes through the API with an Idempotency-Key; the list comes from the server", async () => {
    const user = userEvent.setup();
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json(201, { data: { ref: "AN-1" } });
      return json(200, { data: [{ ref: "AN-0", constituency_key: "demo-1", title: "আগের ঘোষণা", body: "বিবরণ", published_at: "2026-11-01T00:00:00Z" }] });
    });
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><AnnouncementComposer constituency="demo-1" /></ToastProvider>);
    expect(await screen.findByText("আগের ঘোষণা")).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.anFieldTitle), "ড্রেন পরিষ্কার");
    await user.type(screen.getByLabelText(t.anFieldBody), "আগামী সপ্তাহে ওয়ার্ড তিনে ড্রেন পরিষ্কার হবে।");
    await user.click(screen.getByRole("button", { name: t.anPublish }));
    expect(calls(f).some((x) => x[1]?.method === "POST")).toBe(false); // nothing public before the confirm step
    await user.click(screen.getAllByRole("button", { name: t.anPublish, hidden: true }).at(-1)!);
    await vi.waitFor(() => expect(calls(f).some((x) => x[1]?.method === "POST")).toBe(true));
    const post = calls(f).find((x) => x[1]?.method === "POST")!;
    expect(post[0]).toBe("/api/v1/office/announcements");
    expect((post[1]!.headers as Record<string, string>)["Idempotency-Key"]).toBeTruthy();
    expect(JSON.parse(post[1]!.body as string)).toMatchObject({ constituency: "demo-1", title: "ড্রেন পরিষ্কার", publish: true });
    vi.unstubAllGlobals();
  });
});
