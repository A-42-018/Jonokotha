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
