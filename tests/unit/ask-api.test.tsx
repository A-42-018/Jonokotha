import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AskForm from "@/components/ask/AskForm";
import AskInbox from "@/components/ask/AskInbox";
import { ToastProvider } from "@/components/ui/Toast";
import { askBody } from "@/lib/ask-api";
import { dict } from "@/lib/i18n";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("ask your MP", () => {
  it("puts the topic first in the body", () => {
    expect(askBody("সড়ক", " বার্তা ")).toBe("সড়ক\n\nবার্তা");
  });

  it("posts the question with an Idempotency-Key and shows emergency guidance from the server", async () => {
    const user = userEvent.setup();
    const f = vi.fn(async () => json(201, { data: { ref: "Q-1", pii_removed: [], emergency: { kind: "self_harm", guidance: { bn: "এখনই ৯৯৯-এ ফোন করুন", en: "Call 999 now" }, numbers: ["999"] } } }));
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><AskForm signedIn constituency="demo-1" /></ToastProvider>);
    await user.click(screen.getByRole("radio", { name: new RegExp(t.askKindPrivate) }));
    await user.selectOptions(screen.getByLabelText(t.askTopic), "roads");
    await user.type(screen.getByLabelText(t.askSubject), "রাস্তার অবস্থা");
    await user.type(screen.getByLabelText(t.askMessage), "রাস্তায় বড় গর্ত আছে, দেখুন।");
    await user.click(screen.getByRole("button", { name: t.askSend }));
    expect(await screen.findByText("এখনই ৯৯৯-এ ফোন করুন")).toBeInTheDocument();
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/questions");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBeTruthy();
    expect(JSON.parse(init.body as string)).toMatchObject({ constituency: "demo-1", visibility: "private", title: "রাস্তার অবস্থা" });
    vi.unstubAllGlobals();
  });

  it("rate limit shows the limit message", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => json(429, { code: "rate_limited" })));
    render(<ToastProvider><AskForm signedIn constituency="demo-1" /></ToastProvider>);
    await user.click(screen.getByRole("radio", { name: new RegExp(t.askKindPrivate) }));
    await user.selectOptions(screen.getByLabelText(t.askTopic), "roads");
    await user.type(screen.getByLabelText(t.askSubject), "রাস্তার অবস্থা");
    await user.type(screen.getByLabelText(t.askMessage), "রাস্তায় বড় গর্ত আছে, দেখুন।");
    await user.click(screen.getByRole("button", { name: t.askSend }));
    expect(await screen.findByText(t.askLimit)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("inbox lists my questions with status, opens the thread with the office reply, and sends a follow-up", async () => {
    const user = userEvent.setup();
    const q = { ref: "Q-1", constituency_key: "demo-1", visibility: "private", title: "রাস্তা", body: "গর্ত আছে", status: "answered", created_at: "2026-11-10T06:00:00Z", last_message_at: "2026-11-11T06:00:00Z" };
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/v1/me/questions")) return json(200, { data: [q] });
      if (url === "/api/v1/questions/Q-1" && init?.method !== "POST") return json(200, { data: { ...q, messages: [{ author_kind: "office", body: "দেখছি", created_at: "2026-11-11T06:00:00Z" }] } });
      if (url === "/api/v1/questions/Q-1/messages") return json(201, { data: { pii_removed: [] } });
      return json(404, { code: "not_found" });
    });
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><AskInbox /></ToastProvider>);
    expect(await screen.findByText(t.askStatus_answered)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.askShowThread }));
    expect(await screen.findByText("দেখছি")).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.askReplyLabel), "ধন্যবাদ");
    await user.click(screen.getByRole("button", { name: t.askReplySend }));
    await vi.waitFor(() => expect(f.mock.calls.some((c) => String((c as unknown as [string])[0]).endsWith("/messages"))).toBe(true));
    vi.unstubAllGlobals();
  });
});
