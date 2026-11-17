import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CasesPanel from "@/components/office/ws/CasesPanel";
import IdeasReview from "@/components/office/ws/IdeasReview";
import ProjectsManager from "@/components/office/ws/ProjectsManager";
import QuestionsInbox from "@/components/office/ws/QuestionsInbox";
import StaffPanel from "@/components/office/ws/StaffPanel";
import { dict } from "@/lib/i18n";
import { decisionNeedsNote, milestoneNeedsNote, projectBody, sourceNeedsDate, MANAGER_INVITE_ROLES } from "@/lib/office-workspace-api";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.unstubAllGlobals(); });

/** Routes a fake fetch by "METHOD path"; every call is recorded. */
function stub(routes: Record<string, () => Response>) {
  const calls: { key: string; body?: unknown }[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace("/api/v1", "").split("?")[0];
    const key = `${init?.method ?? "GET"} ${path}`;
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = routes[key];
    return r ? r() : json(404, { code: "not_found" });
  });
  vi.stubGlobal("fetch", f);
  return calls;
}

const idea = { ref: "ID-1", constituency_key: "c", category: "road", title: "বাতি লাগান", body: "রাতে অন্ধকার", status: "published", decision_note: null, created_at: "2026-10-01T00:00:00Z", support_count: 4 };

describe("office workspace rules (F5.4)", () => {
  it("a decline needs a reason, a delay needs a note, a source link needs its check date", () => {
    expect(decisionNeedsNote("declined")).toBe(true);
    expect(decisionNeedsNote("planned")).toBe(false);
    expect(milestoneNeedsNote("delayed")).toBe(true);
    expect(sourceNeedsDate({ source_url: "https://a.example" })).toBe(true);
    expect(sourceNeedsDate({ source_url: "https://a.example", source_checked_at: "2026-10-01" })).toBe(false);
    expect(projectBody({ title: " সেতু নির্মাণ ", description: "", budget_text: "৫ কোটি" }, "c")).toEqual({ constituency: "c", title: "সেতু নির্মাণ", status: "planned", budget_text: "৫ কোটি" });
  });
  it("a manager can invite only case officers and agency liaisons", () => {
    expect([...MANAGER_INVITE_ROLES]).toEqual(["case_officer", "agency_liaison"]);
  });
});

describe("ideas review", () => {
  it("declining without a reason sends nothing; with a reason it posts the decision", async () => {
    const calls = stub({ "GET /ideas": () => json(200, { data: [idea] }), "POST /office/ideas/ID-1/decision": () => json(200, { data: {} }) });
    const u = userEvent.setup();
    render(<IdeasReview constituency="c" />);
    expect(await screen.findByRole("heading", { name: "বাতি লাগান" })).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText(t.owIdeaDecision), "declined");
    await u.click(screen.getByRole("button", { name: t.owIdeaSubmit }));
    expect(await screen.findByText(t.owIdeaReasonNeeded)).toBeInTheDocument();
    expect(calls.some((c) => c.key.startsWith("POST"))).toBe(false);
    await u.type(screen.getByLabelText(new RegExp(t.owIdeaReason)), "বাজেট নেই");
    await u.click(screen.getByRole("button", { name: t.owIdeaSubmit }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/ideas/ID-1/decision")?.body).toEqual({ decision: "declined", note: "বাজেট নেই" }));
    expect(screen.getAllByText(t.owPublicWarn).length).toBeGreaterThan(0);
  });
  it("empty and no-access states", async () => {
    stub({ "GET /ideas": () => json(200, { data: [] }) });
    const a = render(<IdeasReview constituency="c" />);
    expect(await screen.findByText(t.owIdeasEmpty)).toBeInTheDocument();
    a.unmount();
    stub({ "GET /ideas": () => json(403, { code: "forbidden" }) });
    render(<IdeasReview constituency="c" />);
    expect(await screen.findByText(t.owNoAccessTitle)).toBeInTheDocument();
  });
});

describe("questions inbox", () => {
  const q = { ref: "Q-1", title: "রাস্তা কবে হবে", body: "জানতে চাই", status: "open", visibility: "private", assigned_to: null, created_at: "2026-10-01T00:00:00Z", last_message_at: "2026-10-02T00:00:00Z" };
  it("take it assigns to me; reply needs ten characters and then posts", async () => {
    const calls = stub({
      "GET /office/questions": () => json(200, { data: [q] }), "GET /me/profile": () => json(200, { data: { id: "u1" } }),
      "POST /office/questions/Q-1/assign": () => json(200, { data: {} }), "GET /questions/Q-1": () => json(200, { data: { ...q, messages: [{ author_kind: "citizen", body: "জানতে চাই", created_at: "2026-10-01T00:00:00Z" }] } }),
      "POST /questions/Q-1/messages": () => json(201, { data: {} }),
    });
    const u = userEvent.setup();
    render(<QuestionsInbox />);
    await u.click(await screen.findByRole("button", { name: t.owQAssignMe }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/questions/Q-1/assign")?.body).toEqual({ assignee: "u1" }));
    await u.click(screen.getByRole("button", { name: new RegExp(t.owQOpen) }));
    const box = await screen.findByLabelText(t.owQReply);
    await u.type(box, "ছোট");
    await u.click(screen.getByRole("button", { name: t.owQReplySend }));
    expect(await screen.findByText(t.owQReplyShort)).toBeInTheDocument();
    await u.clear(box);
    await u.type(box, "আগামী মাসে কাজ শুরু হবে");
    await u.click(screen.getByRole("button", { name: t.owQReplySend }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /questions/Q-1/messages")?.body).toEqual({ body: "আগামী মাসে কাজ শুরু হবে" }));
    expect(screen.getByText(t.owQAssignOther)).toBeInTheDocument();
  });
});

describe("projects", () => {
  it("a source link without a check date is refused before sending; evidence and MP approval are text only", async () => {
    const calls = stub({ "GET /projects": () => json(200, { data: [] }), "POST /office/projects": () => json(201, { data: { ref: "PR-9" } }) });
    const u = userEvent.setup();
    render(<ProjectsManager constituency="c" />);
    await u.type(await screen.findByLabelText(t.owPName), "নতুন সেতু নির্মাণ");
    await u.type(screen.getByLabelText(new RegExp(t.owPSource)), "https://lged.example/p");
    await u.click(screen.getByRole("button", { name: t.owPCreate }));
    expect(await screen.findByText(t.owPSourceNeedsDate)).toBeInTheDocument();
    expect(calls.some((c) => c.key === "POST /office/projects")).toBe(false);
    await u.type(screen.getByLabelText(new RegExp(t.owPChecked)), "2026-10-01");
    await u.click(screen.getByRole("button", { name: t.owPCreate }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/projects")?.body).toMatchObject({ title: "নতুন সেতু নির্মাণ", source_url: "https://lged.example/p", source_checked_at: "2026-10-01" }));
    const planned = document.querySelectorAll("[data-planned]");
    expect(planned.length).toBe(2);
    planned.forEach((p) => expect(within(p as HTMLElement).queryAllByRole("button")).toHaveLength(0));
  });
});

describe("staff and cases", () => {
  it("invite offers two roles, checks the email, and lists invitations with a revoke for pending ones", async () => {
    const inv = { id: "i1", email: "a@b.com", office_role: "case_officer", status: "pending", expires_at: "2026-11-30T00:00:00Z", created_at: "2026-11-01T00:00:00Z", accepted_at: null };
    const calls = stub({ "GET /office/invitations": () => json(200, { data: [inv] }), "POST /office/invitations": () => json(201, { data: {} }), "POST /office/invitations/i1/revoke": () => json(200, { data: {} }) });
    const u = userEvent.setup();
    render(<StaffPanel constituency="c" />);
    expect(await screen.findByText("a@b.com")).toBeInTheDocument();
    expect(within(screen.getByLabelText(t.owStaffRole)).getAllByRole("option")).toHaveLength(2);
    await u.type(screen.getByLabelText(t.owStaffEmail), "bad");
    await u.click(screen.getByRole("button", { name: t.owStaffSend }));
    expect(await screen.findByText(t.owStaffEmailBad)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: new RegExp(t.owStaffRevoke) }));
    await waitFor(() => expect(calls.some((c) => c.key === "POST /office/invitations/i1/revoke")).toBe(true));
    expect(screen.getByText(t.owStaffRolesTitle)).toBeInTheDocument();
  });
  it("my cases: empty state, offline state with retry, and the three planned gaps", async () => {
    stub({ "GET /office/issues": () => json(200, { data: [] }) });
    const a = render(<CasesPanel mode="mine" />);
    expect(await screen.findByText(t.owMineEmpty)).toBeInTheDocument();
    expect(document.querySelectorAll("[data-planned]").length).toBe(3);
    a.unmount();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("x")));
    render(<CasesPanel mode="all" />);
    expect(await screen.findByText(t.owOffline)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.owRetry })).toBeInTheDocument();
  });
});
