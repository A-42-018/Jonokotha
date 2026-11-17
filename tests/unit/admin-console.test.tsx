import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoundaryPanel, EvalsPanel, HealthPanel, UsersPanel } from "@/components/admin/console/AdminConsole";
import { adminSections } from "@/lib/admin-sections";
import { planned } from "@/lib/admin-page";
import { checkBoundary, isIsoDate } from "@/lib/admin-console-api";
import { dict } from "@/lib/i18n";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.unstubAllGlobals(); });

function stub(routes: Record<string, () => Response>) {
  const calls: { key: string; body?: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace("/api/v1", "").split("?")[0];
    const key = `${init?.method ?? "GET"} ${path}`;
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = routes[key];
    return r ? r() : json(404, { code: "not_found" });
  }));
  return calls;
}

const src = { name: "HDX boundaries", url: "https://data.example.org/bd", license: "CC-BY", fetched_at: "2026-11-17" };
const feature = { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: { key: "dhaka-1", name_bn: "ঢাকা-১", name_en: "Dhaka-1" } };
const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("admin console (F5.7)", () => {
  it("boundary form rules: source, licence, date and the file are checked before sending", () => {
    expect(checkBoundary(src, JSON.stringify({ type: "FeatureCollection", features: [feature] })).problems).toEqual([]);
    expect(checkBoundary({ ...src, name: "x", url: "ftp://a", license: "", fetched_at: "17/11" }, "{").problems).toEqual(["name", "url", "license", "date", "json"]);
    expect(checkBoundary(src, JSON.stringify({ type: "FeatureCollection", features: [] })).problems).toEqual(["empty"]);
    expect(checkBoundary(src, JSON.stringify({ type: "FeatureCollection", features: Array(101).fill(feature) })).problems).toEqual(["many"]);
    expect(checkBoundary(src, JSON.stringify({ type: "FeatureCollection", features: [{ ...feature, properties: { key: "A B" } }] })).problems).toEqual(["props"]);
    expect(isIsoDate("2026-13-45")).toBe(false);
  });

  it("every section has a unique page and each planned feature panel has no control", () => {
    const s = adminSections(t);
    expect(new Set(s.map((x) => x.href)).size).toBe(s.length);
    const { container } = render(<>{planned("adminFlags", t.acFlagsT, t.acFlagsB)}{planned("adminDemo", t.acDemoT, t.acDemoB)}</>);
    expect(container.querySelectorAll("[data-planned]")).toHaveLength(2);
    expect(container.querySelectorAll("button, input, select, textarea, a")).toHaveLength(0);
  });

  it("role change needs a valid id and a reason, then posts to the account route", async () => {
    const calls = stub({ [`POST /admin/accounts/${ID}`]: () => json(200, { data: {} }) });
    const u = userEvent.setup();
    render(<UsersPanel />);
    await u.click(screen.getByRole("button", { name: t.acUserSave }));
    expect(screen.getByText(t.acBadId)).toBeInTheDocument();
    expect(screen.getByText(t.acNeedReason)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    await u.type(screen.getByLabelText(t.acUserId), ID);
    await u.type(screen.getByLabelText(t.acUserReason), "মেয়াদ শেষ");
    await u.click(screen.getByRole("button", { name: t.acUserSave }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ role: "staff", status: "active", reason: "মেয়াদ শেষ" });
  });

  it("invitation shows the one-time code once created", async () => {
    stub({ "POST /office/invitations": () => json(201, { data: { id: "i1", expires_at: "2026-11-24T00:00:00Z", invite_token: "abc123", emailed: false } }) });
    const u = userEvent.setup();
    render(<UsersPanel />);
    await u.type(screen.getByLabelText(t.acInviteEmail), "a@b.com");
    await u.type(screen.getByLabelText(t.acInviteArea), "dhaka-1");
    await u.click(screen.getByRole("button", { name: t.acInviteSend }));
    expect(await screen.findByText("abc123")).toBeInTheDocument();
  });

  it("boundary import sends source and geojson only when the form is valid", async () => {
    const calls = stub({ "POST /admin/constituencies/import": () => json(201, { data: {} }) });
    const u = userEvent.setup();
    render(<BoundaryPanel />);
    await u.click(screen.getByRole("button", { name: t.acAreasSend }));
    expect(calls).toHaveLength(0);
    await u.type(screen.getByLabelText(t.acSrcName), src.name);
    await u.type(screen.getByLabelText(t.acSrcUrl), src.url);
    await u.type(screen.getByLabelText(t.acSrcLicense), src.license);
    await u.click(screen.getByLabelText(t.acGeo));
    await u.paste(JSON.stringify({ type: "FeatureCollection", features: [feature] }));
    await u.click(screen.getByRole("button", { name: t.acAreasSend }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0].body as { source: { name: string } }).source.name).toBe(src.name);
  });

  it("evaluation list: empty, and no-access are shown as states", async () => {
    stub({ "GET /admin/ai/evals": () => json(200, { data: [] }) });
    const { unmount } = render(<EvalsPanel />);
    expect(await screen.findByText(t.acEvalEmpty)).toBeInTheDocument();
    unmount();
    stub({ "GET /admin/ai/evals": () => json(403, { code: "forbidden" }) });
    render(<EvalsPanel />);
    expect(await screen.findByText(t.owNoAccessTitle)).toBeInTheDocument();
  });

  it("health reports only the database, up, down or offline, never a guess", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    const { unmount } = render(<HealthPanel />);
    expect(await screen.findByText(t.acHealthDown)).toBeInTheDocument();
    unmount();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    render(<HealthPanel />);
    expect(await screen.findByText(t.acHealthOffline)).toBeInTheDocument();
  });
});
