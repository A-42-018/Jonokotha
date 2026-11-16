import { describe, expect, it, vi } from "vitest";
import { enqueue, flushQueue, sendReport, type QueuedReport, type SendResult } from "@/lib/offline-queue";

const body = { title: "রাস্তায় গর্ত", category: "roads", description: "বাজারের সামনে", area: "ওয়ার্ড ৩", constituencyId: "demo-1" };
const NOW = new Date("2026-12-14T06:00:00Z");

describe("enqueue", () => {
  it("adds a queued report with its title, time and id, without touching the old list", () => {
    const first = enqueue([], body, NOW, "a");
    const second = enqueue(first, { ...body, title: "ড্রেন বন্ধ" }, NOW, "b");
    expect(first).toHaveLength(1);
    expect(second.map((q) => [q.id, q.title, q.state])).toEqual([["a", "রাস্তায় গর্ত", "queued"], ["b", "ড্রেন বন্ধ", "queued"]]);
    expect(second[0].queuedAt).toBe(NOW.toISOString());
  });
});

describe("sendReport", () => {
  const item = { id: "k1", body };
  const reply = (status: number, json: unknown = {}) => vi.fn().mockResolvedValue(new Response(JSON.stringify(json), { status })) as unknown as typeof fetch;

  it("returns the reference on success and sends the id as Idempotency-Key", async () => {
    const f = reply(201, { data: { ref: "JK-1", status: "submitted" } });
    expect(await sendReport(item, f)).toEqual({ kind: "sent", ref: "JK-1" });
    const call = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/v1/issues");
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("k1");
  });
  it("classifies failures: 401 sign-in, other 4xx rejected, 5xx server, thrown error network", async () => {
    expect((await sendReport(item, reply(401))).kind).toBe("unauth");
    expect((await sendReport(item, reply(400))).kind).toBe("rejected");
    expect((await sendReport(item, reply(500))).kind).toBe("server");
    expect((await sendReport(item, reply(429, { code: "rate_limited" }))).kind).toBe("server");
    expect((await sendReport(item, reply(409, { code: "idempotency_in_progress" }))).kind).toBe("server");
    expect((await sendReport(item, vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch)).kind).toBe("network");
  });
});

describe("flushQueue", () => {
  const q = (id: string, state: QueuedReport["state"] = "queued"): QueuedReport => ({ id, title: id, body, queuedAt: NOW.toISOString(), state });
  const script = (results: Record<string, SendResult>) => vi.fn(async (item: QueuedReport) => results[item.id]);

  it("sends all in order and empties the queue", async () => {
    const send = script({ a: { kind: "sent", ref: "R1" }, b: { kind: "sent", ref: "R2" } });
    const out = await flushQueue([q("a"), q("b")], send);
    expect(out.list).toEqual([]);
    expect(out.sent.map((s) => s.ref)).toEqual(["R1", "R2"]);
    expect(send.mock.calls.map((c) => c[0].id)).toEqual(["a", "b"]);
  });
  it("stops at a network failure and keeps the rest queued for later", async () => {
    const send = script({ a: { kind: "network" }, b: { kind: "sent", ref: "R2" } });
    const out = await flushQueue([q("a"), q("b")], send);
    expect(out.stoppedOffline).toBe(true);
    expect(out.list.map((x) => x.id)).toEqual(["a", "b"]);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("marks a sign-in or validation problem on that report and carries on", async () => {
    const send = script({ a: { kind: "unauth" }, b: { kind: "rejected" }, c: { kind: "sent", ref: "R3" } });
    const out = await flushQueue([q("a"), q("b"), q("c")], send);
    expect(out.list.map((x) => [x.id, x.state])).toEqual([["a", "needs-signin"], ["b", "rejected"]]);
    expect(out.sent.map((s) => s.id)).toEqual(["c"]);
  });
  it("never retries a report the server rejected", async () => {
    const send = script({});
    const out = await flushQueue([q("a", "rejected")], send);
    expect(send).not.toHaveBeenCalled();
    expect(out.list[0].state).toBe("rejected");
  });
});
