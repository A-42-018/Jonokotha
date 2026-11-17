import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const token = (name: string) => css.match(new RegExp(`--(?:color-)?${name}:\\s*(#[0-9a-fA-F]{6})`))![1];

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const WHITE = "#ffffff";
const BG = token("background");

describe("colour tokens meet WCAG AA", () => {
  // Text colours on white and on the page background: 4.5:1.
  it.each(["foreground", "civic", "teal-strong", "leaf-strong", "danger", "muted"])("%s text", (name) => {
    expect(ratio(token(name), WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token(name), BG)).toBeGreaterThanOrEqual(4.5);
  });
  it("white text on civic, teal-strong, leaf-strong and danger fills", () => {
    for (const n of ["civic", "teal-strong", "leaf-strong", "danger"]) expect(ratio(WHITE, token(n)), n).toBeGreaterThanOrEqual(4.5);
  });
  it("form-control border is above the 3:1 non-text minimum", () => {
    expect(ratio(token("line"), WHITE)).toBeGreaterThanOrEqual(3);
  });
});

describe("dark theme tokens meet WCAG AA (F7.10)", () => {
  const dk = (name: string) => css.match(new RegExp(`--dk-${name}:\\s*(#[0-9a-fA-F]{6})`))![1];
  const surfaces = ["bg", "surface", "s50", "s100", "s200"] as const;
  it.each(["fg", "muted", "civic", "teal", "leaf", "danger", "amber-text", "brick", "st-progress"])("%s text on every dark surface", (name) => {
    for (const s of surfaces) expect(ratio(dk(name), dk(s)), `${name} on ${s}`).toBeGreaterThanOrEqual(4.5);
  });
  it("form-control borders are above the 3:1 non-text minimum on dark surfaces", () => {
    for (const s of ["bg", "surface"] as const) expect(ratio(dk("line"), dk(s)), s).toBeGreaterThanOrEqual(3);
  });
  it("filled buttons keep white text at 4.5:1 (the fills are not changed in dark mode)", () => {
    for (const n of ["civic", "teal-strong", "leaf-strong", "danger"]) expect(ratio(WHITE, token(n)), n).toBeGreaterThanOrEqual(4.5);
  });
  it("tinted alerts (amber over a dark surface) keep their text readable", () => {
    // amber at 20% over the dark surface, computed channel by channel
    const mix = (fg: string, bg: string, a: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("");
    expect(ratio(dk("amber-text"), mix("#f2a33a", dk("surface"), 0.2))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(dk("fg"), mix(token("civic"), dk("surface"), 0.1))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("homepage redesign colours (docs/HOMEPAGE_REDESIGN_PLAN.md §3.1)", () => {
  it("header band: white and marigold text, and the marigold button's ink text", () => {
    expect(ratio(WHITE, token("brand-deep"))).toBeGreaterThanOrEqual(7);
    expect(ratio(token("amber"), token("brand-deep"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token("ink"), token("amber"))).toBeGreaterThanOrEqual(4.5);
  });
  it("brick report button carries white text (and is not used on the deep band)", () => {
    expect(ratio(WHITE, token("brick"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(WHITE, token("brick-dark"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token("brick"), token("brand-deep"))).toBeLessThan(3);
  });
  it("body ink reaches 7:1 on cream and white; status accents reach 4.5:1 on white cards", () => {
    for (const bg of [WHITE, token("cream")]) expect(ratio(token("ink-2"), bg)).toBeGreaterThanOrEqual(7);
    for (const n of ["brick", "st-progress", "st-done", "civic"]) expect(ratio(token(n), WHITE), n).toBeGreaterThanOrEqual(4.5);
  });
  it("tile and panel labels (fixed ink) stay above 7:1 on every pastel tint", () => {
    const tints = ["#fde3cf", "#f9d5cc", "#d6ecf8", "#fce9b8", "#d5edd9", "#cfe3f5", "#cdebe6", "#fbefc2", "#e3daf3", "#dcefc9", "#d3eef0", "#eceae6", "#f3e6cf", "#e4f0e6", "#ddf1e3"];
    for (const t of tints) expect(ratio(token("ink"), t), t).toBeGreaterThanOrEqual(7);
    expect(ratio(token("civic"), "#f3e6cf")).toBeGreaterThanOrEqual(4.5);
  });
});
