import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import ChallengeForm from "@/components/ChallengeForm";
import DataRights from "@/components/me/DataRights";
import { ToastProvider } from "@/components/ui/Toast";
import { dict } from "@/lib/i18n";
import { challengeText, consentOpen, currentConsent, mailtoUrl, POLICY_VERSION, validateChallenge } from "@/lib/legal";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

describe("legal helpers", () => {
  it("picks the newest privacy consent and treats a withdrawn one as closed", () => {
    const rows = [
      { consent_type: "privacy_notice", policy_version: "0.0", granted_at: "2026-01-01T00:00:00Z", withdrawn_at: "2026-02-01T00:00:00Z" },
      { consent_type: "privacy_notice", policy_version: "0.1", granted_at: "2026-03-01T00:00:00Z", withdrawn_at: null },
      { consent_type: "other", policy_version: "9", granted_at: "2026-04-01T00:00:00Z", withdrawn_at: null },
    ];
    expect(currentConsent(rows)?.policy_version).toBe("0.1");
    expect(consentOpen(currentConsent(rows))).toBe(true);
    expect(consentOpen(currentConsent([rows[0]]))).toBe(false);
    expect(consentOpen(undefined)).toBe(false);
  });
  it("validates a challenge and builds a mailto without leaking markup", () => {
    expect(validateChallenge({ type: "issue", ref: "", why: "short" })).toEqual({ ref: "chRefMissing", why: "chWhyShort" });
    expect(validateChallenge({ type: "idea", ref: "JK-2026-0001", why: "x".repeat(25) })).toEqual({});
    const text = challengeText({ type: "idea", ref: " JK-1 ", why: "because & more" }, { type: "T", ref: "R", why: "W", typeName: "Idea" });
    expect(text).toContain("R: JK-1");
    expect(mailtoUrl("a@b.org", "s p", "x&y=z")).toBe("mailto:a@b.org?subject=s%20p&body=x%26y%3Dz");
  });
});

describe("DataRights", () => {
  const wrap = (signedIn = true) => render(<ToastProvider><DataRights signedIn={signedIn} /></ToastProvider>);

  it("asks signed-out visitors to sign in and calls nothing", () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    wrap(false);
    expect(screen.getByText(t.dtSignIn)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
  });

  it("requires a confirm before requesting deletion, then shows the pending date and lets the person cancel", async () => {
    const user = userEvent.setup();
    let pending: string | null = null;
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      const m = init?.method ?? "GET";
      if (url.endsWith("/me/profile")) return json(200, { data: { id: "u", display_name: null, preferred_language: "bn", account_status: "active", created_at: "2026-01-01T00:00:00Z", deletion_requested_at: pending } });
      if (url.endsWith("/me/consents") && m === "GET") return json(200, { data: [] });
      if (url.endsWith("/me/deletion-request") && m === "POST") { pending = "2026-11-16T05:00:00Z"; return json(202, { data: {} }); }
      if (url.endsWith("/me/deletion-request") && m === "DELETE") { pending = null; return json(200, { data: { cancelled: true } }); }
      return json(404, { code: "not_found" });
    });
    vi.stubGlobal("fetch", f);
    wrap();
    await user.click(await screen.findByRole("button", { name: t.dtDelete }));
    expect(f.mock.calls.some(([u, i]) => String(u).endsWith("/me/deletion-request") && (i as RequestInit | undefined)?.method === "POST")).toBe(false);
    await user.click(screen.getByRole("button", { name: t.dtDeleteYes }));
    await waitFor(() => expect(screen.getByRole("button", { name: t.dtCancel })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: t.dtCancel }));
    await waitFor(() => expect(screen.getByRole("button", { name: t.dtDelete })).toBeInTheDocument());
  });

  it("records consent against the current policy version", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/me/profile")) return json(200, { data: { id: "u", deletion_requested_at: null } });
      if (url.endsWith("/me/consents") && (init?.method ?? "GET") === "GET") return json(200, { data: [] });
      if (url.endsWith("/me/consents")) { bodies.push(JSON.parse(String(init?.body))); return json(200, { data: {} }); }
      return json(404, { code: "not_found" });
    }));
    wrap();
    await user.click(await screen.findByRole("button", { name: t.dtConsentGive }));
    await waitFor(() => expect(bodies).toEqual([{ consent_type: "privacy_notice", policy_version: POLICY_VERSION, granted: true }]));
  });
});

describe("ChallengeForm", () => {
  it("shows field errors, then a ready text with copy, and no send button when no address is set", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ChallengeForm supportEmail="" /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: t.chPrepare }));
    expect(screen.getByText(t.chRefMissing)).toBeInTheDocument();
    expect(screen.getByText(t.chWhyShort)).toBeInTheDocument();
    await user.type(screen.getByLabelText(new RegExp(t.chRef)), "JK-2026-0001");
    await user.type(screen.getByLabelText(new RegExp(t.chWhy)), "এটি ভুলবশত লুকানো হয়েছে, কারণ এতে কোনো নিয়ম ভাঙা হয়নি।");
    await user.click(screen.getByRole("button", { name: t.chPrepare }));
    expect(await screen.findByText(t.chReady)).toBeInTheDocument();
    expect(screen.getByText(t.chNoContact)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t.chSend })).toBeNull();
  });
  it("offers a mailto when an address is set", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ChallengeForm supportEmail="help@example.org" defaultRef="JK-2026-0002" /></ToastProvider>);
    await user.type(screen.getByLabelText(new RegExp(t.chWhy)), "x".repeat(30));
    await user.click(screen.getByRole("button", { name: t.chPrepare }));
    const link = await screen.findByRole("link", { name: t.chSend });
    expect(link.getAttribute("href")).toMatch(/^mailto:help@example\.org\?subject=/);
  });
});
