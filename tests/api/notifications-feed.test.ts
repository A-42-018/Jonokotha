import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as listN } from "../../src/app/api/v1/me/notifications/route";
import { POST as readOne } from "../../src/app/api/v1/me/notifications/[id]/read/route";
import { POST as readAll } from "../../src/app/api/v1/me/notifications/read-all/route";
import { GET as getPrefs, PUT as putPrefs } from "../../src/app/api/v1/me/notification-preferences/route";
import { DELETE as delSub, POST as addSub } from "../../src/app/api/v1/me/push-subscriptions/route";
import { GET as vapid } from "../../src/app/api/v1/notifications/vapid-key/route";
import { GET as feed } from "../../src/app/api/v1/me/feed/route";
import { POST as addFollow } from "../../src/app/api/v1/me/follows/route";
import { POST as cron } from "../../src/app/api/internal/notifications/deliver/route";
import { deliverDue, vapidHeader } from "../../src/lib/notify/deliver";
import { admin, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, B: { id: string; key: string };
let reporter: TestUser, follower: TestUser, stranger: TestUser, manager: TestUser;
const realFetch = globalThis.fetch;
const sent: { url: string; headers: Record<string, string>; body?: string }[] = [];
let pushStatus = 201, mailStatus = 200;

const mkIssue = async (c = A, extra: Record<string, unknown> = {}) => (await admin.from("issues").insert({ reporter_id: reporter.id, title: "SECRET-TITLE pothole", category: "roads", description: "SECRET-DESC", constituency_id: c.id, ...extra }).select("id,ref,created_at").single().throwOnError()).data!;
const notes = async (u: TestUser) => (await admin.from("notifications").select("*").eq("user_id", u.id).order("created_at")).data ?? [];

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service;
  A = await makeConstituency(); B = await makeConstituency();
  reporter = await makeUser("citizen"); follower = await makeUser("citizen"); stranger = await makeUser("citizen");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (u, init) => {
    const url = String(u instanceof Request ? u.url : u);
    if (url.startsWith("https://push.example.test") || url.startsWith("https://mail.example.test")) {
      sent.push({ url, headers: Object.fromEntries(new Headers((init as RequestInit).headers).entries()), body: (init as RequestInit).body as string | undefined });
      return new Response("{}", { status: url.startsWith("https://push") ? pushStatus : mailStatus });
    }
    return realFetch(u, init);
  });
});
afterAll(async () => { as(null); vi.restoreAllMocks(); await cleanup([A.id, B.id]); });

describe("notification events", () => {
  it("a status change notifies the reporter and followers with generic text only; the actor is not notified; each event once", async () => {
    const i = await mkIssue();
    as(follower); expect((await call(addFollow, "POST", "/api/v1/me/follows", { body: { type: "issue", target: i.ref } })).status).toBe(201);
    as(manager);
    await manager.sb.rpc("transition_issue", { p_issue: i.id, p_to: "acknowledged", p_fields: {} }).throwOnError();
    const r = await notes(reporter), f = await notes(follower), m = await notes(manager);
    expect(r).toHaveLength(1); expect(f).toHaveLength(1); expect(m).toHaveLength(0);
    expect(r[0]).toMatchObject({ type: "issue_status", ref: i.ref, title: "অফিস আপনার সমস্যাটি দেখেছে" });
    expect(JSON.stringify(r[0])).not.toMatch(/SECRET/); expect(r[0].data.en.title).toBe("The office has seen your issue");
    // the same event cannot notify twice (dedupe key = event id)
    const { data: ev } = await admin.from("issue_events").select("id").eq("issue_id", i.id).eq("event_type", "status_change");
    await admin.rpc("notify_user", { p_user: reporter.id, p_type: "issue_status", p_title: "x", p_body: "x", p_data: {}, p_dedupe: `ev:${ev![0].id}` });
    expect(await notes(reporter)).toHaveLength(1);
  });
  it("area and category followers hear about new public issues at most once a day; the reporter never", async () => {
    as(stranger); await call(addFollow, "POST", "/api/v1/me/follows", { body: { type: "area", target: A.key } });
    await mkIssue(); await mkIssue();
    expect((await notes(stranger)).filter((n) => n.type === "new_in_area")).toHaveLength(1);
    expect((await notes(reporter)).filter((n) => n.type === "new_in_area")).toHaveLength(0);
    await mkIssue(A, { public_visibility: false });
    expect((await notes(stranger)).filter((n) => n.type === "new_in_area")).toHaveLength(1);
  });
  it("muted types are not delivered", async () => {
    as(follower);
    expect((await call(putPrefs, "PUT", "/api/v1/me/notification-preferences", { body: { muted_types: ["issue_status"] } })).status).toBe(200);
    const i = await mkIssue(); await admin.rpc("notify_user", { p_user: follower.id, p_type: "issue_status", p_title: "t", p_body: "b", p_data: {}, p_dedupe: `mute:${i.id}` });
    expect((await notes(follower)).filter((n) => n.dedupe_key === `mute:${i.id}`)).toHaveLength(0);
    await call(putPrefs, "PUT", "/api/v1/me/notification-preferences", { body: { muted_types: [] } });
  });
});

describe("notification API and preferences", () => {
  it("lists with a cursor, counts unread, marks one or all read, and keeps other people's notifications out of reach", async () => {
    as(reporter);
    for (let n = 0; n < 4; n++) await admin.rpc("notify_user", { p_user: reporter.id, p_type: "announcement", p_title: `t${n}`, p_body: "b", p_data: {}, p_dedupe: `list:${n}` });
    const p1 = await call(listN, "GET", "/api/v1/me/notifications?limit=3");
    expect(p1.json.data).toHaveLength(3); expect(p1.json.page.next_cursor).toBeTruthy();
    const p2 = await call(listN, "GET", `/api/v1/me/notifications?limit=3&cursor=${p1.json.page.next_cursor}`);
    const ids = [...p1.json.data, ...p2.json.data].map((x: { id: string }) => x.id);
    expect(new Set(ids).size).toBe(ids.length); expect(ids.length).toBeGreaterThanOrEqual(5);
    const unread = Number(p1.headers.get("x-unread-count")); expect(unread).toBeGreaterThanOrEqual(5);
    const first = p1.json.data[0].id as string;
    expect((await call(readOne, "POST", `/api/v1/me/notifications/${first}/read`, { params: { id: first } })).json.data.marked).toBe(1);
    expect(Number((await call(listN, "GET", "/api/v1/me/notifications")).headers.get("x-unread-count"))).toBe(unread - 1);
    as(stranger); expect((await call(readOne, "POST", `/api/v1/me/notifications/${first}/read`, { params: { id: first } })).status).toBe(404);
    as(reporter);
    expect((await call(readAll, "POST", "/api/v1/me/notifications/read-all")).json.data.marked).toBe(unread - 1);
    expect((await call(listN, "GET", "/api/v1/me/notifications?unread=true")).json.data).toEqual([]);
    expect((await call(listN, "GET", "/api/v1/me/notifications?cursor=bad")).status).toBe(422);
    as(null); expect((await call(listN, "GET", "/api/v1/me/notifications")).status).toBe(401);
    // a user cannot rewrite the text of a notification, only mark it read
    as(reporter);
    const { error } = await reporter.sb.from("notifications").update({ title: "forged" }).eq("id", first);
    expect(error).not.toBeNull();
  });
  it("validates preferences and returns defaults", async () => {
    as(stranger);
    expect((await call(getPrefs, "GET", "/api/v1/me/notification-preferences")).json.data).toMatchObject({ channels: { in_app: true, push: false, email: false }, quiet_hours: null, timezone: "Asia/Dhaka" });
    const put = (b: object) => call(putPrefs, "PUT", "/api/v1/me/notification-preferences", { body: b });
    expect((await put({ quiet_hours: { start: "25:00", end: "07:00" } })).status).toBe(422);
    expect((await put({ timezone: "Mars/Base" })).status).toBe(422);
    expect((await put({ muted_types: ["nope"] })).status).toBe(422);
    expect((await put({ channels: { in_app: false } })).status).toBe(422);
    const ok = await put({ channels: { email: true }, quiet_hours: { start: "22:00", end: "07:00" }, personalization_enabled: false });
    expect(ok.json.data).toMatchObject({ channels: { in_app: true, push: false, email: true }, quiet_hours: { start: "22:00", end: "07:00" }, personalization_enabled: false });
    await put({ channels: { email: false }, quiet_hours: null, personalization_enabled: true });
  });
});

describe("delivery: push, email, quiet hours, retries, dead letters", () => {
  const sub = "https://push.example.test/device-1";
  beforeAll(() => {
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pub = publicKey.export({ format: "jwk" }), prv = privateKey.export({ format: "jwk" });
    process.env.VAPID_PUBLIC_KEY = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, "base64url"), Buffer.from(pub.y!, "base64url")]).toString("base64url");
    process.env.VAPID_PRIVATE_KEY = prv.d!; process.env.VAPID_SUBJECT = "mailto:test@example.test";
    process.env.EMAIL_PROVIDER = "resend"; process.env.EMAIL_API_KEY = "k"; process.env.EMAIL_FROM = "noreply@example.test"; process.env.EMAIL_API_BASE = "https://mail.example.test";
  });
  const settle = () => admin.from("notification_deliveries").update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() }).in("status", ["pending", "failed", "sending"]);
  const queue = async (u: TestUser, key: string) => { const id = (await admin.rpc("notify_user", { p_user: u.id, p_type: "announcement", p_title: "শিরোনাম", p_body: "নম্বর X", p_data: { en: { title: "Title", body: "Reference X" } }, p_dedupe: key })).data as string; return id; };

  it("push registration needs VAPID, https and a signed-in user; the VAPID header is a valid ES256 JWT for the push origin", async () => {
    as(null); expect((await call(vapid, "GET", "/api/v1/notifications/vapid-key")).json.data.available).toBe(true);
    expect((await call(addSub, "POST", "/api/v1/me/push-subscriptions", { body: { endpoint: sub } })).status).toBe(401);
    as(follower);
    expect((await call(addSub, "POST", "/api/v1/me/push-subscriptions", { body: { endpoint: "http://insecure.test/x" } })).status).toBe(422);
    expect((await call(addSub, "POST", "/api/v1/me/push-subscriptions", { body: { endpoint: sub, keys: { p256dh: "k", auth: "a" } } })).status).toBe(201);
    const h = vapidHeader(sub), jwt = h.match(/t=([^,]+),/)![1].split(".");
    expect(JSON.parse(Buffer.from(jwt[1], "base64url").toString())).toMatchObject({ aud: "https://push.example.test", sub: "mailto:test@example.test" });
    expect(h).toContain(`k=${process.env.VAPID_PUBLIC_KEY}`);
    await call(putPrefs, "PUT", "/api/v1/me/notification-preferences", { body: { channels: { push: true, email: true } } });
  });
  it("sends payload-less push and generic email; marks them sent", async () => {
    const id = await queue(follower, "d:1"); sent.length = 0; await settle();
    const r = await deliverDue(25);
    expect(r).toMatchObject({ sent: 2, failed: 0 });
    const push = sent.find((s) => s.url === sub)!, mail = sent.find((s) => s.url.includes("/emails"))!;
    expect(push.body).toBeUndefined(); expect(push.headers.authorization).toMatch(/^vapid t=/);
    const m = JSON.parse(mail.body!); expect(m.to).toEqual([follower.email]); expect(m.text).toContain("নম্বর X"); expect(m.text).not.toMatch(/SECRET/);
    const { data: d } = await admin.from("notification_deliveries").select("channel,status").eq("notification_id", id); expect(d!.map((x) => x.status)).toEqual(["sent", "sent"]);
  });
  it("retries failures with backoff and moves them to the dead-letter state after 5 tries", async () => {
    const id = await queue(follower, "d:2"); pushStatus = 500; mailStatus = 500;
    for (let n = 1; n <= 5; n++) {
      await settle(); const r = await deliverDue(25); expect(r!.failed).toBe(2);
      const { data: d } = await admin.from("notification_deliveries").select("status,attempts,next_attempt_at").eq("notification_id", id).eq("channel", "push").single();
      expect(d!.attempts).toBe(n); expect(d!.status).toBe(n < 5 ? "failed" : "dead");
      if (n < 5) expect(new Date(d!.next_attempt_at).getTime()).toBeGreaterThan(Date.now() + (2 ** (n - 1) - 0.5) * 60_000);
    }
    await settle(); expect(await deliverDue(25)).toMatchObject({ claimed: 0 });
    pushStatus = 201; mailStatus = 200;
  });
  it("drops devices the push service reports as gone", async () => {
    await queue(follower, "d:3"); pushStatus = 410; await settle();
    await deliverDue(25);
    expect((await admin.from("push_subscriptions").select("id").eq("endpoint", sub)).data).toEqual([]);
    pushStatus = 201;
  });
  it("quiet hours delay push and email but never the in-app notification", async () => {
    as(reporter);
    const hh = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
    const start = hh(new Date(Date.now() - 3_600_000)), end = hh(new Date(Date.now() + 3_600_000));
    await call(putPrefs, "PUT", "/api/v1/me/notification-preferences", { body: { channels: { email: true }, quiet_hours: { start, end } } });
    const id = await queue(reporter, "d:q");
    expect((await admin.from("notifications").select("id").eq("id", id)).data).toHaveLength(1);
    const { data: d } = await admin.from("notification_deliveries").select("next_attempt_at").eq("notification_id", id).eq("channel", "email").single();
    expect(new Date(d!.next_attempt_at).getTime()).toBeGreaterThan(Date.now() + 30 * 60_000);
    sent.length = 0; expect((await deliverDue(25))!.claimed).toBeLessThanOrEqual(0 + (await admin.from("notification_deliveries").select("id").lte("next_attempt_at", new Date().toISOString()).in("status", ["pending", "failed"])).data!.length);
    expect(sent.find((s) => (s.body ?? "").includes(reporter.email))).toBeUndefined();
  });
  it("the worker route needs the cron secret", async () => {
    process.env.CRON_SECRET = "a-long-enough-cron-secret";
    const hit = (h: Record<string, string>) => cron(new Request("http://localhost/api/internal/notifications/deliver", { method: "POST", headers: h }));
    expect((await hit({})).status).toBe(401); expect((await hit({ authorization: "Bearer wrong-secret-value-here" })).status).toBe(401);
    const ok = await hit({ authorization: "Bearer a-long-enough-cron-secret" }); expect(ok.status).toBe(200);
    delete process.env.CRON_SECRET; expect((await hit({ authorization: "Bearer " })).status).toBe(401);
  });
  it("removes a device", async () => {
    as(follower);
    await call(addSub, "POST", "/api/v1/me/push-subscriptions", { body: { endpoint: sub } });
    expect((await call(delSub, "DELETE", "/api/v1/me/push-subscriptions", { body: { endpoint: sub } })).json.data.subscribed).toBe(false);
    expect((await admin.from("push_subscriptions").select("id").eq("endpoint", sub)).data).toEqual([]);
  });
});

describe("feed", () => {
  it("puts what you follow first, then newest; personalized=false is plain newest-first; never ordered by popularity; cursor never skips or repeats", async () => {
    const mk = async (c: typeof A, ageMin: number) => mkIssue(c, { created_at: new Date(Date.now() - ageMin * 60_000).toISOString() });
    const a1 = await mk(A, 50), b1 = await mk(B, 10), a2 = await mk(A, 40), b2 = await mk(B, 5), b3 = await mk(B, 1);
    const reader = await makeUser("citizen");
    as(reader); await call(addFollow, "POST", "/api/v1/me/follows", { body: { type: "area", target: A.key } });
    await admin.from("issue_affected").insert([follower, stranger, reporter].map((u) => ({ issue_id: b3.id, user_id: u.id })));   // popular, but not followed
    const get = async (q = "") => { const out: { ref: string; why: string | null }[] = []; let cur = ""; for (let n = 0; n < 20; n++) { const r = await call(feed, "GET", `/api/v1/me/feed?limit=2${q}${cur}`); out.push(...r.json.data); if (!r.json.page.next_cursor) break; cur = `&cursor=${r.json.page.next_cursor}`; } return out; };
    const mine = (await get()).filter((x) => [a1, a2, b1, b2, b3].some((i) => i.ref === x.ref));
    expect(mine.map((x) => x.ref)).toEqual([a2.ref, a1.ref, b3.ref, b2.ref, b1.ref]);
    expect(mine.slice(0, 2).every((x) => x.why === "area")).toBe(true); expect(mine[2].why).toBeNull();
    const plain = (await get("&personalized=false")).filter((x) => [a1, a2, b1, b2, b3].some((i) => i.ref === x.ref));
    expect(plain.map((x) => x.ref)).toEqual([b3.ref, b2.ref, b1.ref, a2.ref, a1.ref]);
    const all = await get(); expect(new Set(all.map((x) => x.ref)).size).toBe(all.length);
    await call(putPrefs, "PUT", "/api/v1/me/notification-preferences", { body: { personalization_enabled: false } });
    expect((await get()).filter((x) => [a1, a2, b1, b2, b3].some((i) => i.ref === x.ref)).map((x) => x.ref)).toEqual([b3.ref, b2.ref, b1.ref, a2.ref, a1.ref]);
    expect(JSON.stringify(all)).not.toContain(reporter.id);
    as(null); expect((await call(feed, "GET", "/api/v1/me/feed")).status).toBe(401);
    as(reader); expect((await call(feed, "GET", "/api/v1/me/feed?cursor=x")).status).toBe(422);
  });
});
