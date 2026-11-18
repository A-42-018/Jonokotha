// Responsive UI audit harness (no new dependencies: uses the installed @playwright/test, @axe-core/playwright and Chrome).
//
//   node scripts/ui-audit.mjs [--base http://localhost:3000] [--out test-results/ui-audit] [--only /path,/other] [--roles citizen,staff] [--shots]
//
// For every route it loads the page once, then resizes the window through every target viewport (portrait and landscape) and measures:
// document overflow, elements that poke out of the viewport, undersized touch targets, tiny text, clipped text, broken / distorted images, missing alt.
// Once per route (at phone and desktop width) it also runs axe, records console errors, failed requests, layout shift and heading order.
// Read-only: it never submits forms. Roles use the dev demo login (POST /api/demo-login) and only browse.
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3000");
const OUT = arg("out", "test-results/ui-audit");
const ONLY = arg("only", "") ? arg("only", "").split(",") : null;
const ROLES = arg("roles", "anon").split(",");
const SHOTS = process.argv.includes("--shots");
const AXE_ON = !process.argv.includes("--no-axe");
mkdirSync(OUT, { recursive: true });

const PORTRAIT = [
  ["mobile", 320, 568], ["mobile", 360, 800], ["mobile", 375, 812], ["mobile", 390, 844], ["mobile", 414, 896], ["mobile", 430, 932],
  ["tablet", 600, 960], ["tablet", 768, 1024], ["tablet", 820, 1180],
];
const LANDSCAPE = PORTRAIT.map(([g, w, h]) => [g + "-landscape", h, w]);
const FIXED = [
  ["tablet", 1024, 768], ["laptop", 1280, 720], ["laptop", 1366, 768], ["laptop", 1440, 900],
  ["desktop", 1600, 900], ["desktop", 1920, 1080], ["desktop", 2560, 1440],
];
const VIEWPORTS = [...PORTRAIT, ...LANDSCAPE, ...FIXED].map(([group, w, h]) => ({ group, w, h, key: `${w}x${h}` }));

const PUBLIC = ["/", "/about", "/accessibility", "/area", "/ask", "/ask/inbox", "/budget", "/budgeting", "/challenge", "/commitments", "/consultations", "/help", "/help/channels", "/help/contact", "/ideas", "/ideas/new", "/login", "/me", "/metrics", "/mfa", "/mp", "/mp/method", "/mp-records", "/notifications", "/offline", "/open-data", "/polls", "/priorities", "/privacy", "/projects", "/report", "/rti", "/settings", "/terms", "/transparency", "/volunteer", "/volunteer/consent", "/welcome", "/this-page-does-not-exist"];
const OFFICE = ["/office", "/office/agency", "/office/analytics", "/office/announcements", "/office/audit", "/office/budget", "/office/budgeting", "/office/commitments", "/office/consultations", "/office/help", "/office/ideas", "/office/issues", "/office/kpis", "/office/mine", "/office/polls", "/office/priorities", "/office/projects", "/office/questions", "/office/region", "/office/settings", "/office/staff", "/office/volunteers"];
const ADMIN = ["/admin", "/admin/ai-evals", "/admin/ai-runs", "/admin/appeals", "/admin/audit", "/admin/budget", "/admin/categories", "/admin/constituencies", "/admin/countries", "/admin/demo", "/admin/flags", "/admin/health", "/admin/integrations", "/admin/knowledge", "/admin/moderation", "/admin/mp-records", "/admin/regional-admins", "/admin/representatives", "/admin/security", "/admin/stats", "/admin/users", "/admin/verification"];
const ROLE_ROUTES = {
  anon: PUBLIC,
  citizen: ["/me", "/notifications", "/settings", "/ask/inbox", "/report", "/volunteer", "/office", "/admin"],
  staff: OFFICE.concat(["/admin"]),
  officer: ["/office", "/office/mine"],
  mp: ["/office", "/office/analytics", "/office/questions"],
  liaison: ["/office", "/office/agency"],
  moderator: ADMIN.filter((r) => ["/admin", "/admin/moderation", "/admin/appeals", "/admin/users"].includes(r)),
};

// ---- page-side measurement (runs inside the browser) ----
const measure = () => {
  const vw = document.documentElement.clientWidth;
  const sel = (el) => {
    if (el.id) return `#${el.id}`;
    const cls = (typeof el.className === "string" ? el.className : "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    return el.tagName.toLowerCase() + (cls ? "." + cls : "");
  };
  const visible = (el, r) => {
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };
  // An element is "contained" when some ancestor clips or scrolls horizontally and that ancestor itself sits inside the viewport.
  const contained = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { const pr = p.getBoundingClientRect(); if (pr.right <= vw + 1 && pr.left >= -1) return true; }
    }
    return false;
  };
  const out = { vw, scrollW: document.documentElement.scrollWidth, overflowX: document.documentElement.scrollWidth - vw, offenders: [], small: [], smallCount44: 0, tinyText: [], clipped: [], badImg: [], noAlt: [], interactive: 0 };
  const all = document.body.querySelectorAll("*");
  const seenOff = new Set();
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    const cs = getComputedStyle(el);
    // offenders: poke past the right edge (or left edge) of the viewport and are not clipped by a scroller
    if ((r.right > vw + 1 || r.left < -1) && cs.position !== "fixed" && !contained(el) && !el.closest("[aria-hidden='true'], svg, .sr-only")) {
      const key = sel(el);
      if (!seenOff.has(key) && out.offenders.length < 6) { seenOff.add(key); out.offenders.push({ el: key, left: Math.round(r.left), right: Math.round(r.right), text: (el.textContent || "").trim().slice(0, 40) }); }
    }
    const tag = el.tagName;
    const isInteractive = tag === "BUTTON" || (tag === "A" && el.hasAttribute("href")) || tag === "SELECT" || tag === "TEXTAREA" || (tag === "INPUT" && el.type !== "hidden") || el.getAttribute("role") === "button" || tag === "SUMMARY";
    if (isInteractive && !el.closest(".sr-only")) {
      out.interactive++;
      // WCAG 2.5.8 (AA): 24x24 minimum unless inline in a sentence. The project rule is 44px.
      const inline = tag === "A" && cs.display === "inline" && el.closest("p, li, span, dd, td")?.textContent.trim().length > (el.textContent || "").trim().length + 12;
      const isCheck = tag === "INPUT" && /checkbox|radio/.test(el.type);
      const hasLabelBox = isCheck && el.closest("label");
      const lr = hasLabelBox ? el.closest("label").getBoundingClientRect() : r;
      if (!inline) {
        if (lr.width < 24 || lr.height < 24) { if (out.small.length < 8) out.small.push({ el: sel(el), w: Math.round(lr.width), h: Math.round(lr.height), text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30) }); }
        else if (lr.height < 44 || (lr.width < 44 && tag !== "A")) { out.smallCount44++; (out.small44 ??= []).length < 6 && out.small44.push(`${sel(el)} ${Math.round(lr.width)}x${Math.round(lr.height)} ${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 20)}`); }
      }
    }
    // text smaller than 12px that has own text
    if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) {
      const fs = parseFloat(cs.fontSize);
      if (fs < 12 && out.tinyText.length < 5) out.tinyText.push({ el: sel(el), fs, text: el.textContent.trim().slice(0, 30) });
      // clipped: overflow hidden with text wider than box, and not an intentional ellipsis
      if (!el.closest(".sr-only") && /(hidden|clip)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== "ellipsis" && out.clipped.length < 5) out.clipped.push({ el: sel(el), sw: el.scrollWidth, cw: el.clientWidth, text: el.textContent.trim().slice(0, 30) });
      if (!el.closest(".sr-only") && /(hidden|clip)/.test(cs.overflowY) && cs.overflowY !== "visible" && el.scrollHeight > el.clientHeight + 3 && !/line-clamp|-webkit-box/.test(cs.display + cs.webkitLineClamp) && cs.webkitLineClamp === "none" && out.clipped.length < 5) out.clipped.push({ el: sel(el), sh: el.scrollHeight, ch: el.clientHeight, text: el.textContent.trim().slice(0, 30) });
    }
    if (tag === "IMG") {
      if ((!el.complete || el.naturalWidth === 0) && !(el.loading === "lazy" && !el.complete)) { if (out.badImg.length < 5) out.badImg.push({ el: sel(el), why: "broken", src: el.currentSrc.slice(-50) }); }
      else if (!/cover|contain|none|scale-down/.test(cs.objectFit) || cs.objectFit === "fill") {
        const nr = el.naturalWidth / el.naturalHeight, rr = r.width / r.height;
        if (Math.abs(nr - rr) / nr > 0.06 && out.badImg.length < 5) out.badImg.push({ el: sel(el), why: `distorted natural ${nr.toFixed(2)} vs shown ${rr.toFixed(2)}`, src: el.currentSrc.slice(-50) });
      }
      if (el.naturalWidth && r.width > el.naturalWidth * 1.5 && out.badImg.length < 5) out.badImg.push({ el: sel(el), why: `upscaled ${el.naturalWidth}px shown at ${Math.round(r.width)}px`, src: el.currentSrc.slice(-50) });
    }
  }
  // Overlaps: two visible controls / text blocks that are not nested and whose boxes intersect (the 320px header bug was invisible to the overflow checks).
  const boxes = [];
  for (const el of document.body.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,h1,h2,h3,label")) {
    if (el.closest(".sr-only, [aria-hidden='true'], dialog:not([open])")) continue;
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    let fixed = false; for (let p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === "fixed") { fixed = true; break; }
    boxes.push({ el, r, fixed });
  }
  out.overlaps = [];
  for (let i = 0; i < boxes.length && out.overlaps.length < 4; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.fixed !== b.fixed || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 3 && h > 3 && out.overlaps.length < 4) out.overlaps.push(`${sel(a.el)} x ${sel(b.el)} (${Math.round(w)}x${Math.round(h)}) "${(a.el.textContent || "").trim().slice(0, 16)}" / "${(b.el.textContent || "").trim().slice(0, 16)}"`);
  }
  // Fixed bars (bottom tab bar) covering the last focusable content is checked separately by screenshots.
  return out;
};

const pageFacts = () => {
  const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((h) => h.getBoundingClientRect().height > 0 && !h.closest("[aria-hidden='true']"));
  const levels = heads.map((h) => +h.tagName[1]);
  const skips = []; let prev = 0;
  for (const l of levels) { if (prev && l > prev + 1) skips.push(`h${prev}->h${l}`); prev = l; }
  const imgNoAlt = [...document.images].filter((i) => !i.hasAttribute("alt")).map((i) => i.currentSrc.slice(-40));
  const unlabeled = [...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter((f) => !f.labels?.length && !f.getAttribute("aria-label") && !f.getAttribute("aria-labelledby") && !f.title).map((f) => f.outerHTML.slice(0, 80));
  const iconBtnNoName = [...document.querySelectorAll("button,a[href]")].filter((b) => b.getBoundingClientRect().height > 0 && !(b.textContent || "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("aria-labelledby") && !b.title && !b.querySelector("img[alt]:not([alt=''])")).map((b) => b.outerHTML.slice(0, 80));
  const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => h && h.startsWith("/") && !h.startsWith("//"));
  return {
    title: document.title, lang: document.documentElement.lang, h1: levels.filter((l) => l === 1).length, skips, imgNoAlt, unlabeled, iconBtnNoName,
    mainCount: document.querySelectorAll("main").length, deadHash: [...document.querySelectorAll("a[href='#'],a:not([href])")].filter((a) => a.getBoundingClientRect().height > 0).length,
    openDialogs: document.querySelectorAll("dialog[open]").length, links, cls: window.__cls ?? 0, textLen: (document.querySelector("main")?.innerText || "").trim().length,
  };
};

const initScript = () => {
  window.__cls = 0;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
};

const browser = await chromium.launch({ channel: "chrome" });
const all = [];
const discovered = new Set();

async function auditRoute(ctx, role, route) {
  const page = await ctx.newPage();
  const logs = [], failed = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text().slice(0, 180)}`); });
  page.on("pageerror", (e) => logs.push(`pageerror: ${String(e.message).slice(0, 180)}`));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/_next/webpack-hmr")) failed.push(`${r.status()} ${r.url().replace(BASE, "").slice(0, 90)}`); });
  page.on("requestfailed", (r) => { if (!/_next\/webpack-hmr|net::ERR_ABORTED/.test(r.failure()?.errorText + r.url())) failed.push(`FAIL ${r.url().replace(BASE, "").slice(0, 90)} ${r.failure()?.errorText}`); });
  await page.addInitScript(initScript);
  const rec = { role, route, finalUrl: "", status: 0, facts: null, axe: {}, viewports: [], logs, failed, error: null };
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    const resp = await page.goto(BASE + route, { waitUntil: "load", timeout: 90000 });
    rec.status = resp?.status() ?? 0;
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
    rec.finalUrl = page.url().replace(BASE, "");
    rec.facts = await page.evaluate(pageFacts);
    // First-run dialogs (area picker, office tour) are recorded, then closed so the page behind them is what gets measured.
    await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    for (const l of rec.facts.links) discovered.add(l.split("#")[0].split("?")[0]);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.waitForTimeout(120);
      const m = await page.evaluate(measure);
      rec.viewports.push({ ...vp, ...m });
      if (SHOTS && ["375x812", "768x1024", "1280x720"].includes(vp.key)) {
        const f = `${OUT}/shots/${role}${route.replace(/\//g, "_") || "_home"}__${vp.key}.png`;
        mkdirSync(`${OUT}/shots`, { recursive: true });
        await page.screenshot({ path: f, fullPage: true }).catch(() => {});
      }
    }
    if (AXE_ON) for (const [name, w, h] of [["phone", 375, 812], ["desktop", 1280, 800]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(150);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      rec.axe[name] = violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(" ").slice(0, 80)) }));
    }
  } catch (e) { rec.error = String(e.message).slice(0, 200); }
  await page.close();
  all.push(rec);
  const worst = rec.viewports.filter((v) => v.overflowX > 1 || v.offenders.length || v.overlaps.length).length;
  console.log(`${role.padEnd(9)} ${route.padEnd(34)} ${String(rec.status).padEnd(4)} overflow|overlap@${worst}/${VIEWPORTS.length}vp  axe(serious+)=${["phone", "desktop"].map((k) => (rec.axe[k] || []).filter((v) => /serious|critical/.test(v.impact)).length).join("/")}  console=${logs.length} net=${failed.length}${rec.error ? "  ERR " + rec.error : ""}`);
}

async function run() {
  for (const role of ROLES) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: false });
    if (role !== "anon") {
      const r = await ctx.request.post(BASE + "/api/demo-login", { form: { role }, maxRedirects: 0 });
      console.log(`login ${role}: ${r.status()} -> ${r.headers().location ?? ""}`);
    }
    const routes = (ONLY ?? ROLE_ROUTES[role] ?? []);
    for (const route of routes) await auditRoute(ctx, role, route);
    await ctx.close();
  }
  writeFileSync(`${OUT}/results-${ROLES.join("+")}.json`, JSON.stringify({ viewports: VIEWPORTS, results: all, discovered: [...discovered].sort() }, null, 1));
  await browser.close();
}
await run();
