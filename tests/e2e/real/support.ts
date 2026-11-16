import { execSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";

/**
 * Real-stack e2e support (task F.2). These specs run against a LOCAL Supabase and the real /api/v1 routes: no mocks.
 * Start with `npm run test:e2e:real` (scripts/e2e-real.mjs reads `supabase status` and sets E2E_REAL=1).
 * Without E2E_REAL the specs skip, so the normal `npm run test:e2e` still runs on a laptop with no database.
 */
export const REAL = process.env.E2E_REAL === "1";
export const skipUnlessReal = () => test.skip(!REAL, "needs a local Supabase: run `npm run test:e2e:real`");

export function localEnv() {
  let url = process.env.SUPABASE_API_URL, anon = process.env.SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL;
  if (!url || !anon || !service) {
    const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const get = (k: string) => out.match(new RegExp(`^${k}="?([^"\\n]+)"?$`, "m"))?.[1];
    url = get("API_URL"); anon = get("ANON_KEY"); service = get("SERVICE_ROLE_KEY");
  }
  if (!url || !anon || !service) throw new Error("Local Supabase is not running (npx supabase start)");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error("e2e:real only runs against a local Supabase");
  return { url, anon, service };
}

export type Who = "citizenA" | "citizenB" | "officeA" | "officeB" | "moderator" | "admin";
export interface Account { who: Who; id: string; email: string; password: string }
export interface World {
  accounts: Record<Who, Account>;
  /** Office A works in the sample constituency the UI offers (`demo-1`); office B in a constituency made for this run. */
  A: { id: string; key: string };
  B: { id: string; key: string };
  admin: SupabaseClient;
}

let seq = 0;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** The six accounts of masterplan §14 and two constituencies. Unique per call, removed by `dropWorld`. */
export async function buildWorld(info: TestInfo): Promise<World> {
  const env = localEnv();
  const admin = createClient(env.url, env.service, noSession);
  const run = `${Date.now().toString(36)}${seq++}${info.project.name === "mobile-375" ? "m" : "d"}`;
  const password = `E2e-${run}-Aa1!`;

  const find = async (key: string) => (await admin.from("constituencies").select("id,key").eq("key", key).maybeSingle()).data;
  let A = await find("demo-1");
  if (!A) A = (await admin.from("constituencies").insert({ key: "demo-1", name_bn: "নমুনা নির্বাচনী এলাকা", name_en: "Sample Constituency", is_demo: true }).select("id,key").single().throwOnError()).data!;
  const B = (await admin.from("constituencies").insert({ key: `e2e-b-${run}`, name_bn: "বি", name_en: `E2E B ${run}`, is_demo: true }).select("id,key").single().throwOnError()).data!;

  const make = async (who: Who, role: "citizen" | "staff" | "moderator" | "admin", office?: { c: string; role: string }): Promise<Account> => {
    const email = `e2e-${who.toLowerCase()}-${run}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("createUser failed");
    if (role !== "citizen") await admin.from("profiles").update({ role }).eq("id", data.user.id).throwOnError();
    if (office) await admin.from("office_members").insert({ user_id: data.user.id, constituency_id: office.c, office_role: office.role }).throwOnError();
    return { who, id: data.user.id, email, password };
  };
  const accounts = {
    citizenA: await make("citizenA", "citizen"),
    citizenB: await make("citizenB", "citizen"),
    officeA: await make("officeA", "staff", { c: A.id, role: "office_manager" }),
    officeB: await make("officeB", "staff", { c: B.id, role: "office_manager" }),
    moderator: await make("moderator", "moderator"),
    admin: await make("admin", "admin"),
  } satisfies Record<Who, Account>;
  return { accounts, A, B, admin };
}

export async function dropWorld(w: World) {
  const ids = Object.values(w.accounts).map((a) => a.id);
  await w.admin.from("issues").delete().in("reporter_id", ids);
  await w.admin.from("office_members").delete().in("user_id", ids);
  for (const id of ids) await w.admin.auth.admin.deleteUser(id);
  await w.admin.from("constituencies").delete().eq("id", w.B.id);
}

/** Sign in with a password and put the same cookies the app would set into the browser context. */
export async function signInAs(context: BrowserContext, acct: Account, baseURL: string, lang: "bn" | "en" = "en") {
  const env = localEnv();
  const jar = new Map<string, string>();
  const sb = createServerClient(env.url, env.anon, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => jar.set(c.name, c.value)) } });
  const { error } = await sb.auth.signInWithPassword({ email: acct.email, password: acct.password });
  if (error) throw error;
  await context.clearCookies();
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL })).concat([{ name: "lang", value: lang, url: baseURL }, { name: "constituency", value: "demo-1", url: baseURL }]));
}

/** A fresh browser context signed in as `acct`; its `request` carries the session cookie, so API calls are made as that person. */
export async function sessionFor(browser: import("@playwright/test").Browser, info: TestInfo, acct: Account | null, lang: "bn" | "en" = "en") {
  const baseURL = info.project.use.baseURL ?? "http://localhost:3000";
  const context = await browser.newContext({ ...info.project.use, baseURL });
  if (acct) await signInAs(context, acct, baseURL, lang);
  else await context.addCookies([{ name: "lang", value: lang, url: baseURL }]);
  return context;
}

export interface Reply { status: number; json: { data?: any; code?: string; field_errors?: Record<string, string>; page?: any; request_id?: string }; headers: Record<string, string> } // eslint-disable-line @typescript-eslint/no-explicit-any
let key = 0;
export async function api(req: APIRequestContext, method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH", path: string, body?: unknown): Promise<Reply> {
  const res = await req.fetch(`/api/v1${path}`, {
    method,
    headers: { "idempotency-key": `e2e-${Date.now().toString(36)}-${key++}-${Math.random().toString(36).slice(2, 8)}` },
    ...(body === undefined ? {} : { data: body }),
  });
  let json: Reply["json"] = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status(), json, headers: res.headers() };
}

export async function jpeg(): Promise<Buffer> {
  return sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 80, g: 120, b: 160 } } }).jpeg().toBuffer();
}

export async function uploadPhoto(req: APIRequestContext, ref: string, caption = "e2e photo") {
  const res = await req.post(`/api/v1/issues/${ref}/media`, { multipart: { file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: await jpeg() }, caption } });
  return { status: res.status(), json: await res.json().catch(() => ({})) };
}

/** Submit an issue as whoever `req` is signed in as. A point inside Bangladesh with a map pin. */
export async function submitIssue(req: APIRequestContext, w: World, over: Record<string, unknown> = {}) {
  const r = await api(req, "POST", "/issues", {
    title: "রাস্তায় বড় গর্ত, রাতে বিপদ", category: "roads", description: "বাজারের সামনের রাস্তায় বড় গর্ত। রাতে দুর্ঘটনার ঝুঁকি আছে।",
    area: "ওয়ার্ড ৩", constituencyId: w.A.key, lat: 23.7808, lng: 90.4075, locationSource: "map", ...over,
  });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.data.ref as string;
}

/** Move an issue to `acknowledged` then `resolved` as office A (used when a scenario only needs a resolved issue). */
export async function resolveIssue(office: APIRequestContext, ref: string) {
  expect((await api(office, "POST", `/office/issues/${ref}/acknowledge`, { message: "পেয়েছি, কাজ শুরু হবে।" })).status).toBe(200);
  const r = await api(office, "POST", `/office/issues/${ref}/resolve`, { resolution_note: "গর্ত ভরাট করা হয়েছে।", evidence_url: "https://example.test/evidence/fixed.jpg" });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
}

export const gotoOk = async (page: Page, path: string) => { const res = await page.goto(path); expect(res?.status(), path).toBeLessThan(400); await page.waitForLoadState("networkidle"); };

/** Latest 6-8 digit sign-in code sent to `email` through the local mail catcher (Mailpit, port 54324). */
export async function latestCode(email: string): Promise<string | null> {
  const base = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  for (let i = 0; i < 20; i++) {
    try {
      const list = await (await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json() as { messages?: { ID: string }[] };
      const id = list.messages?.[0]?.ID;
      if (id) {
        const msg = await (await fetch(`${base}/api/v1/message/${id}`)).json() as { Text?: string };
        const m = msg.Text?.match(/\b(\d{6,8})\b/);
        if (m) return m[1];
      }
    } catch { return null; }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
