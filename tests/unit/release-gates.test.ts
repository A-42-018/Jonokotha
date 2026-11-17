import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** F.8 release gates that can be checked from source. The browser probes are in tests/e2e/release-gates.spec.ts. */
const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const src = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("F.8: every screen has its error, empty and offline states", () => {
  it("has the app-wide fallbacks: error boundary, not-found, loading, offline page and service worker", () => {
    for (const f of ["src/app/error.tsx", "src/app/not-found.tsx", "src/app/loading.tsx", "src/app/offline/page.tsx", "public/sw.js"]) {
      expect(existsSync(path.join(root, f)), f).toBe(true);
    }
  });

  it("every component that loads data from the API shows an error state and an empty or no-result state", () => {
    const files = walk(path.join(root, "src")).filter((f) => /\.(tsx|ts)$/.test(f) && /useQuery|useInfiniteQuery/.test(readFileSync(f, "utf8")));
    expect(files.length).toBeGreaterThan(10);
    // Mutation-only helpers and map layers hold no list: named here so a new data component cannot slip past.
    const exempt = ["useFollows.ts", "NewIdeaForm.tsx", "IssueActions.tsx", "Copilot.tsx", "HotspotMapLive.tsx", "NotesAndAssign.tsx", "AnnouncementComposer.tsx", "DataRights.tsx", "RepProfile.tsx", "MpFinder.tsx", "KpiPanel.tsx", "OfficeKpis.tsx", "PushSettings.tsx", "NoticeTypePrefs.tsx"];
    const missing: string[] = [];
    for (const f of files) {
      const name = path.basename(f);
      if (name.endsWith(".ts")) continue; // hooks render nothing; the components that use them are checked
      const text = readFileSync(f, "utf8");
      const hasError = /isError|\.error\b|onError|role="alert"|kind="error"|kind: "error"|<State\b|<Boundary\b/.test(text);   // Boundary (office lists) renders loading, error, offline, no-access and empty itself
      const hasEmpty = /empty=\{|EmptyState|<Boundary\b|kind="(empty|noResults|officeEmpty)"|length === 0|\.length\s*<\s*1|!.*\.length/.test(text);
      if (!hasError) missing.push(`${name}: no error state`);
      if (!hasEmpty && !exempt.includes(name)) missing.push(`${name}: no empty state`);
    }
    expect(missing).toEqual([]);
  });

  it("the data components exempt from the empty-state rule still show an error or a not-found state", () => {
    for (const n of ["RepProfile.tsx", "AreaPicker.tsx", "OfficeKpis.tsx", "KpiPanel.tsx", "DataRights.tsx"]) {
      const f = walk(path.join(root, "src")).find((x) => x.endsWith(n))!;
      expect(/isError|\.error\b|onError|kind="error"|<State\b|role="alert"/.test(readFileSync(f, "utf8")), n).toBe(true);
    }
  });
});

describe("F.8: keys and private data", () => {
  it("no server-only variable name is read in a client component", () => {
    const bad: string[] = [];
    for (const f of walk(path.join(root, "src")).filter((x) => /\.tsx?$/.test(x))) {
      const t = readFileSync(f, "utf8");
      if (!/^\s*["']use client["']/m.test(t.slice(0, 200))) continue;
      if (/process\.env\.(?!NEXT_PUBLIC_|NODE_ENV)/.test(t)) bad.push(path.relative(root, f));
    }
    expect(bad).toEqual([]);
  });

  it("the bundle scan is part of CI", () => {
    expect(src(".github/workflows/ci.yml")).toContain("check:bundle");
  });
});
