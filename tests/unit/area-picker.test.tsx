import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AreaPicker from "@/components/mp/AreaPicker";
import QueryProvider from "@/components/QueryProvider";
import I18nProvider from "@/components/ui/I18nProvider";
import { deepest, isNotSwitchedOn, needsConfirm, trimChain } from "@/lib/areas-api";
import { ApiError } from "@/lib/api-client";
import { FEATURES } from "@/lib/capability";
import { dict } from "@/lib/i18n";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const area = (key: string) => ({ key, name_bn: `এলাকা ${key}`, name_en: `Area ${key}`, district: null, is_demo: false });
const rep = (id: string) => ({ id, full_name: `নাম ${id}`, office_title: null, official_contact: null, source_url: "https://example.org/a", verified_at: "2026-10-01", is_sample: false });

function mount(mode: "find" | "choose" = "find", onConfirm?: () => void) {
  return render(<I18nProvider lang="bn" dicts={{ bn: t }}><QueryProvider><AreaPicker mode={mode} onConfirm={onConfirm} /></QueryProvider></I18nProvider>);
}
afterEach(() => vi.unstubAllGlobals());

describe("area helpers", () => {
  it("narrows the chain when an earlier level changes", () => {
    expect(trimChain(["d1", "u1", "w1"], 1, "u2")).toEqual(["d1", "u2"]);
    expect(trimChain(["d1", "u1"], 0, "")).toEqual([]);
    expect(deepest(["d1", "u1"])).toBe("u1");
    expect(deepest([])).toBeUndefined();
  });
  it("asks for confirmation only when more than one constituency is possible", () => {
    expect(needsConfirm(undefined)).toBe(false);
    expect(needsConfirm({ matches: [{ constituency: area("a"), representatives: [] }], needs_manual_choice: false })).toBe(false);
    expect(needsConfirm({ matches: [{ constituency: area("a"), representatives: [] }, { constituency: area("b"), representatives: [] }], needs_manual_choice: false })).toBe(true);
  });
  it("reads 404 and 501 as not switched on, other failures as errors", () => {
    expect(isNotSwitchedOn(new ApiError("not_found", 404))).toBe(true);
    expect(isNotSwitchedOn(new ApiError("x", 501))).toBe(true);
    expect(isNotSwitchedOn(new ApiError("internal_error", 500))).toBe(false);
    expect(isNotSwitchedOn(new ApiError("network", 0))).toBe(false);
  });
  it("lists the hierarchy as planned until B5.7 ships", () => {
    expect(FEATURES.areaHierarchy).toMatchObject({ status: "planned", backend: "B5.7" });
    expect(FEATURES.areaCorrection.backend).toBe("B5.7");
  });
});

describe("AreaPicker", () => {
  it("shows the cascade as not switched on when the server has no hierarchy, keeping search and a planned correction panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, { code: "not_found" })));
    mount();
    expect(await screen.findByText(t.arCascadeOffTitle)).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: new RegExp(t.mpSearch) })).toBeInTheDocument();
    expect(screen.getByText(t.arCorrectTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.arCorrectTitle })).toBeNull();
  });

  it("walks district then upazila and, when two constituencies are possible, lists both and lets the citizen confirm", async () => {
    const user = userEvent.setup();
    const f = vi.fn(async (url: string) => {
      if (url === "/api/v1/areas") return json(200, { data: { level: "district", label_bn: "জেলা", label_en: "District", areas: [{ id: "d1", name_bn: "জেলা ১", name_en: "District 1" }] } });
      if (url === "/api/v1/areas?parent=d1") return json(200, { data: { level: "upazila", label_bn: "উপজেলা", label_en: "Upazila", areas: [] } });
      if (url === "/api/v1/areas/d1/constituencies") return json(200, { data: { needs_manual_choice: false, matches: [{ constituency: area("a"), representatives: [rep("r1")] }, { constituency: area("b"), representatives: [rep("r2")] }] } });
      return json(404, {});
    });
    vi.stubGlobal("fetch", f);
    mount();
    await user.selectOptions(await screen.findByLabelText("জেলা"), "d1");
    expect(await screen.findByText(/২টি নির্বাচনী এলাকার/)).toBeInTheDocument();
    expect(screen.getByText("নাম r1")).toBeInTheDocument();
    expect(screen.getByText("নাম r2")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: t.mpConfirm })[1]);
    expect(screen.getByText("নাম r2")).toBeInTheDocument();
    expect(screen.queryByText("নাম r1")).toBeNull();
  });

  it("choose mode hands the confirmed constituency to the caller and shows no representative card", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/v1/areas") return json(200, { data: { level: "district", label_bn: "", label_en: "", areas: [{ id: "d1", name_bn: "জেলা ১", name_en: "District 1" }] } });
      if (url.startsWith("/api/v1/areas?parent")) return json(200, { data: { level: "x", label_bn: "", label_en: "", areas: [] } });
      return json(200, { data: { needs_manual_choice: false, matches: [{ constituency: area("a"), representatives: [rep("r1")] }] } });
    }));
    mount("choose", onConfirm);
    await user.selectOptions(await screen.findByLabelText(t.arDistrictLabel), "d1");
    await user.click(await screen.findByRole("button", { name: t.arMine }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("নাম r1")).toBeNull();
  });

  it("shows an error with retry when the lookup fails", { timeout: 15_000 }, async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.startsWith("/api/v1/areas") ? json(404, {}) : json(500, { code: "internal_error" }))));
    const user = userEvent.setup();
    mount();
    await user.type(await screen.findByRole("searchbox"), "ওয়ার্ড ৩");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("alert", {}, { timeout: 6000 })).toHaveTextContent(t.mpLoadError);
  });
});
