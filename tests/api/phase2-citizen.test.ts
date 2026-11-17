import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { POST as intake } from "../../src/app/api/v1/ai/intake/route";
import { POST as translate } from "../../src/app/api/v1/ai/translate/route";
import { POST as transcribe } from "../../src/app/api/v1/ai/transcribe/route";
import { GET as search } from "../../src/app/api/v1/constituencies/search/route";
import { GET as repLookup } from "../../src/app/api/v1/representatives/lookup/route";
import { GET as listPublic, POST as createIssue } from "../../src/app/api/v1/issues/route";
import { GET as listMedia, POST as upload } from "../../src/app/api/v1/issues/[ref]/media/route";
import { POST as reviewMedia } from "../../src/app/api/v1/office/issues/[ref]/media/[id]/route";
import { admin, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, citizen: TestUser, other: TestUser, manager: TestUser, ref: string, issueId: string;
let seq = 0;
const key = () => `k-${Date.now().toString(36)}-${seq++}-xxxx`;
const SQUARE = { type: "Polygon", coordinates: [[[90.40, 23.70], [90.45, 23.70], [90.45, 23.75], [90.40, 23.75], [90.40, 23.70]], [[90.42, 23.72], [90.43, 23.72], [90.43, 23.73], [90.42, 23.73], [90.42, 23.72]]] };

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service;
  A = await makeConstituency();
  await admin.from("constituencies").update({ boundary: SQUARE, min_lat: 23.70, max_lat: 23.75, min_lng: 90.40, max_lng: 90.45, district: "Testpur", name_en: `Testville ${A.key}` }).eq("id", A.id).throwOnError();
  citizen = await makeUser("citizen"); other = await makeUser("citizen");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
});
afterAll(async () => { as(null); vi.restoreAllMocks(); await cleanup([A.id]); });

describe("intake v2", () => {
  const ask = (body: unknown) => call(intake, "POST", "/api/v1/ai/intake", { body });
  it("needs sign-in and a valid body", async () => {
    as(null); expect((await ask({ text: "road broken" })).status).toBe(401);
    as(citizen); expect((await ask({ text: "x" })).status).toBe(422);
    expect((await ask({ text: "road broken here", extra: 1 })).status).toBe(422);
  });
  it("drafts without submitting; Banglish and Bangla get Bangla output language, English stays English; PII is flagged", async () => {
    as(citizen);
    const before = (await admin.from("issues").select("id", { count: "exact", head: true })).count;
    const a = (await ask({ text: "amar rasta onek kharap, gorto hoyeche. call 01712345678" })).json.data;
    expect(a).toMatchObject({ language: "bn", source: "fallback", category: expect.any(String), urgency: "routine" });
    expect(a.pii_warnings).toContain("phone"); expect(a.description).not.toContain("01712345678");
    expect((await ask({ text: "রাস্তায় বড় গর্ত আছে" })).json.data.language).toBe("bn");
    expect((await ask({ text: "The road outside the school has a pothole" })).json.data.language).toBe("en");
    expect((await ask({ text: "The road has a pothole", language: "bn" })).json.data.language).toBe("bn");
    expect((await admin.from("issues").select("id", { count: "exact", head: true })).count).toBe(before);
  });
  it("danger words always raise urgency and point to 999", async () => {
    as(citizen);
    const d = (await ask({ text: "বিদ্যুতের তার ছিঁড়ে রাস্তায় পড়ে আছে" })).json.data;
    expect(d.urgency).toBe("urgent"); expect(d.urgency_guidance).toContain("৯৯৯");
    expect((await ask({ text: "a live wire is down near the market", language: "en" })).json.data.urgency_guidance).toContain("999");
  });
});

describe("translate and transcribe", () => {
  it("translation is on demand and says when it is unavailable", async () => {
    as(citizen);
    const r = await call(translate, "POST", "/api/v1/ai/translate", { body: { text: "রাস্তা খারাপ", to: "en" } });
    expect(r.json.data).toMatchObject({ available: false, machine_translated: true, target: "en" });
    as(null); expect((await call(translate, "POST", "/api/v1/ai/translate", { body: { text: "x", to: "en" } })).status).toBe(401);
  });

  const audio = (bytes: number[], name = "a.webm") => { const f = new FormData(); f.set("audio", new File([new Uint8Array([...bytes, ...new Array(400).fill(1)])], name, { type: "audio/webm" })); f.set("language", "bn"); return f; };
  

  const send = async (form: FormData) => {
    const req = new Request("http://localhost/api/v1/ai/transcribe", { method: "POST", body: form, headers: { "x-forwarded-for": `10.9.${seq++ % 250}.1` } });
    const res = await transcribe(req);
    return { status: res.status, json: await res.json() };
  };
  it("checks the type by content, and reports unavailable when no provider is configured", async () => {
    as(citizen);
    expect((await send(audio([0x00, 0x01, 0x02, 0x03]))).status).toBe(422);
    expect((await send(audio([0x1a, 0x45, 0xdf, 0xa3]))).json.data).toEqual({ available: false, reason: "not_configured" });
  });
  it("redacts spoken personal data from the transcript", async () => {
    process.env.TRANSCRIBE_BASE_URL = "https://stt.example.test/v1"; process.env.TRANSCRIBE_API_KEY = "k";
    const real = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (u, init) => String(u instanceof Request ? u.url : u).startsWith("https://stt.example.test")
      ? new Response(JSON.stringify({ text: "আমার নম্বর 01712345678 রাস্তা খারাপ" }), { status: 200 }) : real(u, init));
    as(citizen);
    const r = await send(audio([0x1a, 0x45, 0xdf, 0xa3]));
    expect(r.json.data).toMatchObject({ available: true, pii_warnings: ["phone"] });
    expect(r.json.data.text).not.toContain("01712345678");
    vi.restoreAllMocks(); delete process.env.TRANSCRIBE_BASE_URL; delete process.env.TRANSCRIBE_API_KEY;
  });
});

describe("location and maps", () => {
  const lookup = (q: string) => call(repLookup, "GET", `/api/v1/representatives/lookup?${q}`);
  it("finds the constituency by point (boundary, with holes), rejects bad coordinates, falls back to manual", async () => {
    as(null);
    expect((await lookup("lat=23.71&lng=90.41")).json.data.matches[0].constituency).toMatchObject({ key: A.key, method: "boundary" });
    const hole = (await lookup("lat=23.725&lng=90.425")).json.data;
    expect(hole.matches).toEqual([]); expect(hole.needs_manual_choice).toBe(true);
    expect((await lookup("lat=0&lng=0")).status).toBe(422);
    expect((await lookup("lat=23.7")).status).toBe(422);
    expect((await lookup("")).status).toBe(422);
    const s = await call(search, "GET", "/api/v1/constituencies/search?q=Testville");
    expect(s.json.data.map((r: { key: string }) => r.key)).toContain(A.key);
    expect((await call(search, "GET", "/api/v1/constituencies/search?q=a")).status).toBe(422);
  });
  it("lists only verified, current representatives of the area", async () => {
    const mk = async (name: string, status: string, valid_to: string | null) => {
      const { data } = await admin.from("representatives").insert({ full_name: name, verification_status: status, is_demo: true, source_url: "https://example.test/src" }).select("id").single().throwOnError();
      await admin.from("representative_constituencies").insert({ representative_id: data!.id, constituency_id: A.id, valid_to }).throwOnError();
    };
    await mk("Verified Current", "verified", null); await mk("Unverified", "unverified", null); await mk("Verified Past", "verified", "2020-01-01");
    as(null);
    const r = (await lookup(`area=${encodeURIComponent(A.key)}`)).json.data.matches[0];
    expect(r.representatives.map((x: { full_name: string }) => x.full_name)).toEqual(["Verified Current"]);
    await admin.from("representatives").delete().in("full_name", ["Verified Current", "Unverified", "Verified Past"]);
  });
  it("creates issues with coordinates: area derived from the point, exact point private, public point approximate", async () => {
    as(citizen);
    const r = await call(createIssue, "POST", "/api/v1/issues", { headers: { "idempotency-key": key() }, body: { title: "Pothole by the pond", category: "roads", description: "Deep hole.", area: "Pond road", lat: 23.7123456, lng: 90.4123456, locationSource: "device", locationAccuracyM: 12 } });
    expect(r.status).toBe(201); ref = r.json.data.ref;
    const { data: row } = await admin.from("issues").select("id,constituency_key,lat,lng,public_lat,public_lng").eq("ref", ref).single();
    issueId = row!.id;
    expect(row!.constituency_key).toBe(A.key);
    expect(row!.lat).toBeCloseTo(23.7123456, 6);
    expect(Math.abs(row!.public_lat! - row!.lat!)).toBeLessThan(0.0016); expect(row!.public_lat).not.toBe(row!.lat);
    as(null);
    const pub = (await call(listPublic, "GET", `/api/v1/issues?constituency=${A.key}`)).json.data[0];
    expect(pub.location).toEqual({ lat: row!.public_lat, lng: row!.public_lng, approximate: true });
    expect(JSON.stringify(pub)).not.toContain("23.7123456");
  });
  it("rejects impossible, half-given and out-of-area coordinates", async () => {
    as(citizen);
    const go = (body: object) => call(createIssue, "POST", "/api/v1/issues", { headers: { "idempotency-key": key() }, body: { title: "Pothole", category: "roads", description: "Hole here", ...body } });
    expect((await go({ lat: 0, lng: 0 })).status).toBe(422);
    expect((await go({ lat: 90.4, lng: 23.7 })).status).toBe(422);   // swapped
    expect((await go({ lat: 23.7 })).status).toBe(422);
    const outside = await go({ lat: 22.5, lng: 91.5 });               // in Bangladesh, in no constituency
    expect(outside.status).toBe(422); expect(outside.json.field_errors).toHaveProperty("constituencyId");
  });
  it("filters the public list by area text, dates and distance", async () => {
    as(null);
    const get = (q: string) => call(listPublic, "GET", `/api/v1/issues?constituency=${A.key}&${q}`);
    expect((await get("area=pond")).json.data).toHaveLength(1);
    expect((await get("area=nowhere")).json.data).toHaveLength(0);
    const today = new Date().toISOString().slice(0, 10);
    expect((await get(`from=${today}&to=${today}`)).json.data).toHaveLength(1);
    expect((await get("to=2020-01-01")).json.data).toHaveLength(0);
    expect((await get("near=23.7125,90.4125&radius_km=2")).json.data).toHaveLength(1);
    expect((await get("near=23.9,90.9&radius_km=2")).json.data).toHaveLength(0);
    expect((await get("near=bad")).status).toBe(422);
    expect((await get("from=yesterday")).status).toBe(422);
  });
});

describe("media", () => {
  const form = (buf: Buffer | Uint8Array, name = "p.jpg") => { const f = new FormData(); f.set("file", new File([new Uint8Array(buf)], name, { type: "image/jpeg" })); f.set("caption", "the hole"); return f; };
  const post = async (r: string, f: FormData) => { const res = await upload(new Request(`http://localhost/api/v1/issues/${r}/media`, { method: "POST", body: f, headers: { "x-forwarded-for": `10.8.${seq++ % 250}.1` } }), { params: Promise.resolve({ ref: r }) } as never); return { status: res.status, json: await res.json() }; };
  let mediaId: string;

  it("strips EXIF (including GPS), resizes, and stores privately; only the owner can upload", async () => {
    const jpg = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#c33" } }).withExif({ IFD0: { Copyright: "secret-owner" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "23/1 42/1 0/1" } }).jpeg().toBuffer();
    expect((await sharp(jpg).metadata()).exif).toBeTruthy();
    as(citizen);
    const r = await post(ref, form(jpg));
    expect(r.status).toBe(201); mediaId = r.json.data.id;
    expect(r.json.data).toMatchObject({ width: 1600, visibility: "private", moderation_status: "pending" });
    const { data: row } = await admin.from("issue_media").select("storage_path,scan_status,mime_type").eq("id", mediaId).single();
    const blob = await admin.storage.from("issue-media").download(row!.storage_path);
    const stored = Buffer.from(await blob.data!.arrayBuffer());
    const md = await sharp(stored).metadata();
    expect(md.exif).toBeUndefined(); expect(stored.includes(Buffer.from("secret-owner"))).toBe(false);
    expect(row).toMatchObject({ mime_type: "image/jpeg" });
    as(other); expect((await post(ref, form(jpg))).status).toBe(404);
    as(null); expect((await post(ref, form(jpg))).status).toBe(401);
  });
  it("rejects wrong types by content, unreadable files, oversize and the sixth photo", async () => {
    as(citizen);
    expect((await post(ref, form(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "x.jpg"))).status).toBe(422);
    expect((await post(ref, form(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(300, 7)])))).json.field_errors).toHaveProperty("file");
    expect((await post(ref, form(Buffer.alloc(9 * 1024 * 1024, 1)))).status).toBe(422);
    const small = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#333" } }).jpeg().toBuffer();
    for (let i = 0; i < 4; i++) expect((await post(ref, form(small))).status).toBe(201);
    const sixth = await post(ref, form(small));
    expect(sixth.status).toBe(409); expect(sixth.json.code).toBe("rule_not_met");
  });
  it("signed URLs for the owner; the public sees a photo only after the office approves it for public display", async () => {
    const list = (r: string) => call(listMedia, "GET", `/api/v1/issues/${r}/media`, { params: { ref: r } });
    as(citizen);
    const mine = (await list(ref)).json.data;
    expect(mine.length).toBe(5); expect(mine[0].url).toMatch(/^http/);
    as(null); expect((await list(ref)).json.data).toEqual([]);
    as(other); expect((await list(ref)).json.data).toEqual([]);
    const review = (b: object) => call(reviewMedia, "POST", `/api/v1/office/issues/${ref}/media/${mediaId}`, { body: b, params: { ref, id: mediaId } });
    as(citizen); expect((await review({ visibility: "public", status: "approved" })).status).toBe(403);
    as(manager);
    expect((await review({ visibility: "public", status: "rejected" })).status).toBe(422);
    expect((await review({ visibility: "public", status: "approved" })).json.data).toMatchObject({ visibility: "public" });
    as(null);
    const pub = (await list(ref)).json.data;
    expect(pub).toHaveLength(1); expect(pub[0]).not.toHaveProperty("visibility");
    expect(await (await fetch(pub[0].url)).arrayBuffer()).toBeTruthy();
    const { data: audit } = await admin.from("audit_logs").select("action").eq("resource_id", mediaId).eq("action", "issue_media.review");
    expect(audit?.length).toBeGreaterThan(0);
  });
  it("cleans up uploaded objects", async () => {
    const { data } = await admin.from("issue_media").select("storage_path").eq("issue_id", issueId);
    if (data?.length) await admin.storage.from("issue-media").remove(data.map((d) => d.storage_path));
  });
});
