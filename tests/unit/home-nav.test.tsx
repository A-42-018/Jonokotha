import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivePolls, AreaRepCard, ExploreLinks, HomeSnapshot, PopularIdeas } from "@/components/citizen/HomeBlocks";
import MoreMenu from "@/components/ui/MoreMenu";
import ProjectsList from "@/components/projects/ProjectsList";
import { dict } from "@/lib/i18n";
import { loadSnapshot, shownCount, type Snapshot } from "@/lib/home-data";
import { moreNav, primaryNav } from "@/lib/nav-items";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.unstubAllGlobals(); });

describe("navigation (F5.1)", () => {
  it("top bar has projects, ask your MP, find your MP; consultations stay hidden until the flag is on", () => {
    const hrefs = primaryNav({ consultations: false }).map((i) => i.href);
    expect(hrefs).toEqual(["/", "/area", "/projects", "/ideas", "/ask", "/mp"]);
    expect(primaryNav({ consultations: true }).map((i) => i.href)).toContain("/consultations");
    expect(moreNav().map((i) => i.href)).toEqual(["/polls", "/help", "/terms"]);
  });
  it("More menu opens, lists polls and help, and closes on Escape", async () => {
    render(<MoreMenu path="/" />);
    const btn = screen.getByRole("button", { name: new RegExp(t.navMore) });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(screen.getByRole("link", { name: t.navPolls })).toHaveAttribute("href", "/polls");
    expect(screen.getByRole("link", { name: t.navHelp })).toHaveAttribute("href", "/help");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: t.navPolls })).toBeNull();
  });
});

describe("home blocks (F5.2)", () => {
  const snap = (r: number, p: number, d: number): { ok: true; data: Snapshot } => ({ ok: true, data: { reported: r, inProgress: p, resolved: d, from: "2026-10-01T00:00:00Z", to: "2026-10-31T00:00:00Z", days: 30 } });

  it("shows counts with period, update time and the definition link; small groups are not shown as a number", () => {
    render(<HomeSnapshot t={t} lang="bn" snap={snap(40, 3, 12)} areaName="এলাকা" sample />);
    expect(screen.getByText(t.hvSnapFew)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.mxHow })).toHaveAttribute("href", "/metrics#area");
    expect(screen.getByText(t.capSample)).toBeInTheDocument();
    expect(screen.getByText(/গত ৩০ দিন/)).toBeInTheDocument();
  });
  it("snapshot error is an alert, never zeros", () => {
    render(<HomeSnapshot t={t} lang="bn" snap={{ ok: false }} areaName="এলাকা" sample={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent(t.hvSnapError);
  });
  it("shownCount hides groups under five", () => { expect(shownCount(4)).toBeNull(); expect(shownCount(5)).toBe(5); expect(shownCount(0)).toBeNull(); });

  it("loadSnapshot counts through the public view and fails as a whole", async () => {
    const chain = (count: number, error: unknown = null) => { const c: Record<string, unknown> = {}; for (const m of ["eq", "gte", "in"]) c[m] = () => c; c.then = (res: (v: unknown) => void) => res({ count, error }); return c; };
    const ok = { from: () => ({ select: () => chain(7) }) };
    const r = await loadSnapshot(ok as never, "demo-1");
    expect(r.ok && r.data.reported).toBe(7);
    const bad = { from: () => ({ select: () => chain(0, { message: "x" }) }) };
    expect((await loadSnapshot(bad as never, "demo-1")).ok).toBe(false);
  });

  it("popular ideas: list, empty and error states", () => {
    const { rerender } = render(<PopularIdeas t={t} lang="bn" ideas={{ ok: true, data: [{ ref: "ID-1", title: "আলো", support_count: 8, is_demo: false }] }} />);
    expect(screen.getByText("আলো")).toBeInTheDocument();
    rerender(<PopularIdeas t={t} lang="bn" ideas={{ ok: true, data: [] }} />);
    expect(screen.getByText(t.hvIdeasEmpty)).toBeInTheDocument();
    rerender(<PopularIdeas t={t} lang="bn" ideas={{ ok: false }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(t.hvIdeasError);
  });

  it("representative card: verified rep with date and source, none published, and error", () => {
    const rep = { id: "r1", full_name: "রহিম", office_title: "সংসদ সদস্য", source_url: "https://parliament.example/x", verified_at: "2026-10-01T00:00:00Z", is_demo: false };
    const { rerender } = render(<AreaRepCard t={t} lang="bn" rep={{ ok: true, data: rep }} areaName="এলাকা" />);
    expect(screen.getByText("রহিম")).toBeInTheDocument();
    expect(screen.getByText(/parliament\.example/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.mpProfile })).toHaveAttribute("href", "/mp/r1");
    rerender(<AreaRepCard t={t} lang="bn" rep={{ ok: true, data: null }} areaName="এলাকা" />);
    expect(screen.getByText(t.hvRepNone)).toBeInTheDocument();
    rerender(<AreaRepCard t={t} lang="bn" rep={{ ok: false }} areaName="এলাকা" />);
    expect(screen.getByRole("alert")).toHaveTextContent(t.hvRepError);
  });

  it("active polls block says not switched on and holds nothing to press; explore links reach projects, ask, find MP, polls, help", () => {
    const { container } = render(<><ActivePolls t={t} /><ExploreLinks t={t} /></>);
    const polls = container.querySelector("[data-planned]") as HTMLElement;
    expect(polls.querySelectorAll("button, a, input")).toHaveLength(0);
    const nav = screen.getByRole("navigation");
    for (const h of ["/projects", "/ask", "/mp", "/polls", "/help"]) expect(within(nav).getAllByRole("link").some((a) => a.getAttribute("href") === h)).toBe(true);
  });
});

describe("ProjectsList", () => {
  const wrap = () => render(<ProjectsList constituency="demo-1" />);
  it("empty, error with retry, and list with source and date", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(403, { code: "forbidden" })).mockResolvedValueOnce(json(200, { data: [] })));
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: t.pjRetry }));
    expect(await screen.findByText(t.pjEmptyTitle)).toBeInTheDocument();
  });
  it("lists a project with status, budget wording as the office gave it, and a safe source link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { data: [
      { ref: "PR-1", constituency_key: "demo-1", title: "সেতু", description: null, status: "in_progress", budget_text: "৫ কোটি টাকা", start_date: null, expected_end_date: "2027-01-01", source_url: "https://lged.example/p1", source_checked_at: "2026-10-01", is_sample: true, updated_at: "2026-10-10T00:00:00Z" },
      { ref: "PR-2", constituency_key: "demo-1", title: "খারাপ লিংক", description: null, status: "planned", budget_text: null, start_date: null, expected_end_date: null, source_url: "javascript:alert(1)", source_checked_at: null, updated_at: "2026-10-10T00:00:00Z" },
    ] })));
    wrap();
    expect(await screen.findByText("সেতু")).toBeInTheDocument();
    expect(screen.getByText(t.pjSt_in_progress)).toBeInTheDocument();
    expect(screen.getByText(t.capSample)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: t.pjSource })).toHaveLength(1);
  });
});
