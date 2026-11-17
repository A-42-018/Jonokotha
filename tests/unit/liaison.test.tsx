import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LiaisonPanel from "@/components/office/ws/LiaisonPanel";
import { dict } from "@/lib/i18n";
import { noteTooShort } from "@/lib/liaison-api";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.unstubAllGlobals(); });

function stub(routes: Record<string, () => Response>) {
  const calls: { key: string; url: string; body?: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace("/api/v1", "").split("?")[0];
    const key = `${init?.method ?? "GET"} ${path}`;
    calls.push({ key, url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = routes[key];
    return r ? r() : json(404, { code: "not_found" });
  }));
  return calls;
}

const issue = { ref: "JK-9", title: "ড্রেন বন্ধ", status: "referred_to_authority", updated_at: "2026-11-10T00:00:00Z" };

describe("agency liaison workspace (F5.5)", () => {
  it("note needs ten characters", () => {
    expect(noteTooShort("ছোট")).toBe(true);
    expect(noteTooShort("কাজ শুরু হয়েছে")).toBe(false);
  });

  it("shows the not-official banner, asks only for referred cases, posts an internal note by default", async () => {
    const calls = stub({
      "GET /office/issues": () => json(200, { data: [issue] }),
      "GET /office/issues/JK-9": () => json(200, { data: { referrals: [{ agency_name: "ওয়াসা", external_reference: "W-1", forwarded_at: "2026-11-05T00:00:00Z" }] } }),
      "POST /office/issues/JK-9/update": () => json(200, { data: {} }),
    });
    const u = userEvent.setup();
    render(<LiaisonPanel />);
    expect(await screen.findByRole("heading", { name: "ড্রেন বন্ধ" })).toBeInTheDocument();
    expect(calls[0].url).toContain("status=referred_to_authority");
    expect(screen.getByRole("note")).toHaveTextContent(t.lsNotOfficial);
    await u.click(screen.getByRole("button", { name: new RegExp(t.lsOpenDetail) }));
    expect(await screen.findByText(/ওয়াসা/)).toBeInTheDocument();
    expect(screen.getByText(t.rfOfficeRefNote)).toBeInTheDocument();
    await u.type(screen.getByLabelText(t.lsNote), "ছোট");
    await u.click(screen.getByRole("button", { name: t.lsNoteSend }));
    expect(await screen.findByText(t.lsNoteShort)).toBeInTheDocument();
    await u.clear(screen.getByLabelText(t.lsNote));
    await u.type(screen.getByLabelText(t.lsNote), "কাজ শুরু হয়েছে");
    await u.click(screen.getByRole("button", { name: t.lsNoteSend }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/issues/JK-9/update")?.body).toEqual({ note: "কাজ শুরু হয়েছে" }));
  });

  it("show-to-citizen sends public: true; unfinished features are text only; empty and no-access states", async () => {
    const calls = stub({ "GET /office/issues": () => json(200, { data: [issue] }), "GET /office/issues/JK-9": () => json(200, { data: {} }), "POST /office/issues/JK-9/update": () => json(200, { data: {} }) });
    const u = userEvent.setup();
    const a = render(<LiaisonPanel />);
    await u.click(await screen.findByRole("button", { name: new RegExp(t.lsOpenDetail) }));
    expect(await screen.findByText(t.lsNoReferral)).toBeInTheDocument();
    await u.type(screen.getByLabelText(t.lsNote), "কাজ চলছে, শিগগির শেষ হবে");
    await u.click(screen.getByLabelText(new RegExp(t.lsNotePublic)));
    await u.click(screen.getByRole("button", { name: t.lsNoteSend }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/issues/JK-9/update")?.body).toEqual({ note: "কাজ চলছে, শিগগির শেষ হবে", public: true }));
    const planned = document.querySelectorAll("[data-planned]");
    expect(planned.length).toBe(3);
    planned.forEach((p) => expect(within(p as HTMLElement).queryAllByRole("button")).toHaveLength(0));
    a.unmount();
    stub({ "GET /office/issues": () => json(200, { data: [] }) });
    const b = render(<LiaisonPanel />);
    expect(await screen.findByText(t.lsEmpty)).toBeInTheDocument();
    b.unmount();
    stub({ "GET /office/issues": () => json(403, { code: "forbidden" }) });
    render(<LiaisonPanel />);
    expect(await screen.findByText(t.owNoAccessTitle)).toBeInTheDocument();
  });
});
