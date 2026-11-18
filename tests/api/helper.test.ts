import { afterAll, describe, expect, it } from "vitest";
import { POST as chat } from "../../src/app/api/v1/helper/chat/route";
import { GET as speechInfo, POST as speech } from "../../src/app/api/v1/helper/speech/route";
import { admin, as, call, cleanup, makeUser } from "./harness";

/** Dadu (migration 0090): the three switches, the public chat route, and the server voice's refusals. Runs against the LOCAL Supabase only (npm run test:api). */
async function flag(key: string, enabled: boolean) { await admin.from("feature_flags").update({ enabled }).eq("key", key).throwOnError(); }
const say = (text: string, o: { voice?: boolean; page?: string } = {}) => ({ body: { messages: [{ role: "user", text }], lang: "bn", page: o.page ?? "/", voice: o.voice ?? false } });

afterAll(async () => { for (const k of ["helper", "helper_ai", "helper_speech"]) await flag(k, false); await cleanup(); });

describe("Dadu chat", () => {
  it("is off until the flag is on: 404 feature_disabled", async () => {
    await flag("helper", false);
    const r = await call(chat, "POST", "/api/v1/helper/chat", say("সমস্যা জানাব কীভাবে?"));
    expect(r.status).toBe(404);
    expect(r.json.code).toBe("feature_disabled");
  });

  it("answers anyone, signed in or not, without a model", async () => {
    await flag("helper", true);
    as(null);
    const r = await call(chat, "POST", "/api/v1/helper/chat", say("সমস্যা জানাব কীভাবে?"));
    expect(r.status).toBe(200);
    expect(r.json.data.intent).toBe("report");
    expect(r.json.data.source).toBe("rules");
    expect(r.json.data.blocks.some((b: { type: string }) => b.type === "link")).toBe(true);
  });

  it("emergency words get fixed guidance only", async () => {
    await flag("helper", true);
    const r = await call(chat, "POST", "/api/v1/helper/chat", say("আমি আত্মহত্যা করতে চাই", { voice: true }));
    expect(r.json.data.source).toBe("emergency");
    expect(r.json.data.blocks).toHaveLength(1);
  });

  it("a spoken request navigates, a typed one does not, and a signed-out person is sent to sign in first", async () => {
    await flag("helper", true);
    as(null);
    const v = await call(chat, "POST", "/api/v1/helper/chat", say("পোলের পাতায় নিয়ে যাও", { voice: true }));
    expect(v.json.data.blocks[0]).toMatchObject({ type: "navigate", href: "/polls" });
    expect((await call(chat, "POST", "/api/v1/helper/chat", say("পোলের পাতায় নিয়ে যাও"))).json.data.blocks.some((b: { type: string }) => b.type === "navigate")).toBe(false);
    const r = await call(chat, "POST", "/api/v1/helper/chat", say("রিপোর্ট করতে চাই", { voice: true }));
    expect(r.json.data.blocks[0].href).toBe("/login?need=1&next=%2Freport");
    as(await makeUser("citizen"));
    expect((await call(chat, "POST", "/api/v1/helper/chat", say("রিপোর্ট করতে চাই", { voice: true }))).json.data.blocks[0].href).toBe("/report");
  });

  it("never navigates to staff or admin pages", async () => {
    await flag("helper", true);
    const r = await call(chat, "POST", "/api/v1/helper/chat", say("admin পাতায় নিয়ে যাও", { voice: true }));
    expect(r.json.data.blocks.some((b: { type: string }) => b.type === "navigate")).toBe(false);
  });

  it("rejects bad bodies", async () => {
    await flag("helper", true);
    expect((await call(chat, "POST", "/api/v1/helper/chat", { body: { messages: [], lang: "bn" } })).status).toBe(422);
    expect((await call(chat, "POST", "/api/v1/helper/chat", { body: { messages: [{ role: "user", text: "x" }], lang: "fr" } })).status).toBe(422);
    expect((await call(chat, "POST", "/api/v1/helper/chat", { body: { messages: [{ role: "user", text: "x" }], lang: "bn", page: "https://evil.example/" } })).status).toBe(422);
    expect((await call(chat, "POST", "/api/v1/helper/chat", { body: { messages: [{ role: "user", text: "x".repeat(501) }], lang: "bn" } })).status).toBe(422);
  });

  it("limits one address to 20 questions a minute", async () => {
    await flag("helper", true);
    as(null);
    const ip = "10.9.9.9";
    let last = 0;
    for (let i = 0; i < 25; i++) last = (await call(chat, "POST", "/api/v1/helper/chat", { ...say("হ্যালো"), ip })).status;
    expect(last).toBe(429);
  });
});

describe("Dadu server voice", () => {
  it("is off until its flag is on, and says it is unavailable without Azure keys", async () => {
    await flag("helper_speech", false);
    expect((await call(speechInfo, "GET", "/api/v1/helper/speech")).json.code).toBe("feature_disabled");
    await flag("helper_speech", true);
    delete process.env.AZURE_SPEECH_KEY;
    const info = await call(speechInfo, "GET", "/api/v1/helper/speech");
    expect(info.json.data.available).toBe(false);
    const r = await call(speech, "POST", "/api/v1/helper/speech", { body: { text: "হ্যালো", lang: "bn" } });
    expect(r.status).toBe(503);
  });
  it("rejects empty or long text and unknown languages", async () => {
    await flag("helper_speech", true);
    expect((await call(speech, "POST", "/api/v1/helper/speech", { body: { text: "", lang: "bn" } })).status).toBe(422);
    expect((await call(speech, "POST", "/api/v1/helper/speech", { body: { text: "ক".repeat(601), lang: "bn" } })).status).toBe(422);
    expect((await call(speech, "POST", "/api/v1/helper/speech", { body: { text: "x", lang: "xx" } })).status).toBe(422);
  });
});
