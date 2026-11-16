import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import MoreInfo from "@/components/issue/MoreInfo";
import ProgressEvidence from "@/components/issue/ProgressEvidence";
import EvidenceStep from "@/components/report/EvidenceStep";
import ReportSuccess from "@/components/ReportSuccess";
import { ToastProvider } from "@/components/ui/Toast";
import { dict } from "@/lib/i18n";
import { reportSchema } from "@/lib/report";
import { REPORT_DESC_MAX, withExtras } from "@/lib/report-extras";
import { uploadPhotosTracked } from "@/lib/report-api";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.unstubAllGlobals(); });

describe("withExtras", () => {
  it("adds one labelled line, only for what was chosen", () => {
    expect(withExtras("Road broken.", {}, dict.en)).toBe("Road broken.");
    expect(withExtras("Road broken.", { duration: "weeks" }, dict.en)).toBe("Road broken.\n\n[How long: A few weeks.]");
    expect(withExtras("X", { duration: "days", who: "many" }, dict.en)).toBe("X\n\n[How long: A few days. Who is affected: Many people.]");
    expect(withExtras("X", { duration: "bogus", who: "" }, dict.en)).toBe("X");
  });
  it("the form limit leaves room for the line, so the sent text stays within the API's 2000", () => {
    const longest = withExtras("a".repeat(REPORT_DESC_MAX), { duration: "long", who: "vulnerable" }, t);
    expect(longest.length).toBeLessThanOrEqual(2000);
    const r = reportSchema(dict.en).safeParse({ category: "roads", title: "Broken road", area: "Ward 1", description: "a".repeat(REPORT_DESC_MAX + 1) });
    expect(r.success).toBe(false);
  });
});

describe("uploadPhotosTracked", () => {
  it("reports progress after every photo and returns exactly the ones that failed", async () => {
    const photos = [1, 2, 3].map((n) => ({ blob: new Blob([String(n)]), caption: `c${n}` }));
    const up = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({});
    const seen: number[] = [];
    const failed = await uploadPhotosTracked("JK-1", photos, up, (n, total) => { expect(total).toBe(3); seen.push(n); });
    expect(seen).toEqual([1, 2, 3]);
    expect(failed).toEqual([photos[1]]);
  });
});

describe("EvidenceStep", () => {
  it("says video is not switched on and offers no video control", () => {
    const { container } = render(<ToastProvider><EvidenceStep t={t} lang="bn" photos={[]} onChange={() => {}} /></ToastProvider>);
    expect(screen.getByText(t.rxVideoBody)).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')?.getAttribute("accept") ?? "").not.toMatch(/video/);
  });
});

describe("ReportSuccess photo retry", () => {
  it("retries only the photos that failed and says when all are sent", async () => {
    const f = vi.fn().mockResolvedValue(json(201, { data: { id: "m1" } }));
    vi.stubGlobal("fetch", f);
    const photos = [{ blob: new Blob(["a"]), caption: "" }, { blob: new Blob(["b"]), caption: "" }];
    render(<ToastProvider><ReportSuccess t={t} lang="bn" refId="JK-1" failedPhotos={photos} onAnother={() => {}} /></ToastProvider>);
    expect(screen.getByText(t.sentPhotosFailed)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: t.rxRetry }));
    await waitFor(() => expect(screen.getByText(t.rxRetryDone)).toBeInTheDocument());
    expect(f).toHaveBeenCalledTimes(2);
    expect(String(f.mock.calls[0][0])).toBe("/api/v1/issues/JK-1/media");
  });
});

describe("ProgressEvidence", () => {
  const wrap = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
  it("shows an empty state when no photo is published", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { data: [] })));
    wrap(<ProgressEvidence refId="JK-1" signedIn={false} />);
    expect(await screen.findByText(t.rxEvEmpty)).toBeInTheDocument();
  });
  it("shows an error with retry", async () => {
    const f = vi.fn().mockResolvedValueOnce(json(403, { code: "forbidden" })).mockResolvedValue(json(200, { data: [] }));
    vi.stubGlobal("fetch", f);
    wrap(<ProgressEvidence refId="JK-1" signedIn={false} />);
    await userEvent.click(await screen.findByRole("button", { name: t.rxEvRetry }));
    expect(await screen.findByText(t.rxEvEmpty)).toBeInTheDocument();
  });
  it("lists approved photos, each with a report control, and skips photos without a URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { data: [
      { id: "m1", url: "https://x.test/a.jpg", caption: "Repaired", width: 1, height: 1 },
      { id: "m2", url: null, caption: null, width: 1, height: 1 },
    ] })));
    wrap(<ProgressEvidence refId="JK-1" signedIn={false} />);
    expect(await screen.findByAltText("Repaired")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: t.rcSignIn })).toHaveLength(1);
  });
});

describe("MoreInfo", () => {
  const wrap = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
  it("sends signed-out visitors to sign in", () => {
    wrap(<MoreInfo refId="JK-1" signedIn={false} />);
    expect(screen.getByRole("link", { name: t.rxMoreSignIn })).toHaveAttribute("href", expect.stringContaining("/login?need=1&next="));
  });
  it("refuses a too-short message, then posts to additional-information", async () => {
    const f = vi.fn().mockResolvedValue(json(201, { data: {} }));
    vi.stubGlobal("fetch", f);
    wrap(<MoreInfo refId="JK-1" signedIn />);
    await userEvent.click(screen.getByRole("button", { name: t.rxMoreSend }));
    expect(await screen.findByText(t.rxMoreShort)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(new RegExp(t.rxMoreLabel)), "The hole is two metres wide.");
    await userEvent.click(screen.getByRole("button", { name: t.rxMoreSend }));
    expect(await screen.findByText(t.rxMoreSent)).toBeInTheDocument();
    expect(String(f.mock.calls[0][0])).toBe("/api/v1/issues/JK-1/additional-information");
    expect(JSON.parse(f.mock.calls[0][1].body as string)).toEqual({ message: "The hole is two metres wide." });
  });
  it("shows an error when the server refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(409, { code: "invalid_transition" })));
    wrap(<MoreInfo refId="JK-1" signedIn />);
    await userEvent.type(screen.getByLabelText(new RegExp(t.rxMoreLabel)), "More details here.");
    await userEvent.click(screen.getByRole("button", { name: t.rxMoreSend }));
    expect(await screen.findByText(t.rxMoreFail)).toBeInTheDocument();
  });
});
