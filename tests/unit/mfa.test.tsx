import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MfaPanel from "@/components/MfaPanel";
import { dict } from "@/lib/i18n";
import { classifyMfaError, isMfaRequired, mfaUrl } from "@/lib/mfa";

const push = vi.fn();
const refresh = vi.fn();
const listFactors = vi.fn();
const enroll = vi.fn();
const unenroll = vi.fn();
const challengeAndVerify = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/mfa" }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({ auth: { mfa: { listFactors, enroll, unenroll, challengeAndVerify } } }) }));

const t = dict.bn;
beforeEach(() => { for (const f of [push, refresh, listFactors, enroll, unenroll, challengeAndVerify]) f.mockReset(); });

describe("mfa helpers", () => {
  it("builds a same-site step-up URL and never loops back to /mfa", () => {
    expect(mfaUrl("/admin/audit")).toBe("/mfa?next=%2Fadmin%2Faudit");
    expect(mfaUrl("//evil.com")).toBe("/mfa?next=%2F");
    expect(mfaUrl("/mfa?next=/x")).toBe("/mfa?next=%2F");
  });
  it("recognises the API's mfa_required error and nothing else", () => {
    expect(isMfaRequired({ status: 403, code: "forbidden", fieldErrors: { _: "mfa_required" } })).toBe(true);
    expect(isMfaRequired({ status: 403, code: "forbidden", fieldErrors: { _: "cross_site" } })).toBe(false);
    expect(isMfaRequired({ status: 401, code: "unauthenticated" })).toBe(false);
  });
  it("sorts Supabase errors into our four messages", () => {
    expect(classifyMfaError({ status: 429, message: "x" })).toBe("tooMany");
    expect(classifyMfaError({ message: "MFA enroll is disabled for TOTP" })).toBe("unavailable");
    expect(classifyMfaError({ code: "mfa_verification_failed", message: "Invalid TOTP code entered" })).toBe("wrong");
    expect(classifyMfaError({ status: 500, message: "boom" })).toBe("other");
  });
});

describe("MfaPanel", () => {
  it("enrols: shows the QR and the secret, verifies the code, then goes back to the page", async () => {
    listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
    enroll.mockResolvedValue({ data: { id: "f1", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DPEHPK3PXP" } }, error: null });
    challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<MfaPanel next="/admin/audit" email="admin@example.test" />);
    await user.click(await screen.findByRole("button", { name: t.mfaStart }));
    expect(await screen.findByAltText(t.mfaQrAlt)).toBeInTheDocument();
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.mfaCode), "123 456");
    await user.click(screen.getByRole("button", { name: t.mfaVerify }));
    await waitFor(() => expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/audit"));
    expect(refresh).toHaveBeenCalled();
  });

  it("clears an unfinished earlier attempt before enrolling again", async () => {
    listFactors.mockResolvedValue({ data: { all: [{ id: "old", factor_type: "totp", status: "unverified" }], totp: [] }, error: null });
    enroll.mockResolvedValue({ data: { id: "f2", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "S" } }, error: null });
    const user = userEvent.setup();
    render(<MfaPanel next="/admin" email="a@example.test" />);
    await user.click(await screen.findByRole("button", { name: t.mfaStart }));
    await waitFor(() => expect(unenroll).toHaveBeenCalledWith({ factorId: "old" }));
  });

  it("asks only for the code when a factor is already linked; a wrong code shows a message and stays", async () => {
    listFactors.mockResolvedValue({ data: { all: [], totp: [{ id: "f9" }] }, error: null });
    challengeAndVerify.mockResolvedValue({ data: null, error: { code: "mfa_verification_failed", message: "Invalid TOTP code entered", status: 400 } });
    const user = userEvent.setup();
    render(<MfaPanel next="/admin" email="a@example.test" />);
    await user.type(await screen.findByLabelText(t.mfaCode), "000000");
    expect(screen.queryByAltText(t.mfaQrAlt)).toBeNull();
    await user.click(screen.getByRole("button", { name: t.mfaVerify }));
    expect(await screen.findByText(t.mfaWrongCode)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("says plainly when two-step sign-in is switched off on the server", async () => {
    listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
    enroll.mockResolvedValue({ data: null, error: { message: "MFA enroll is disabled for TOTP", status: 422 } });
    const user = userEvent.setup();
    render(<MfaPanel next="/admin" email="a@example.test" />);
    await user.click(await screen.findByRole("button", { name: t.mfaStart }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.mfaUnavailable);
  });

  it("tells a person who lost their phone what to do, without inventing recovery codes", async () => {
    listFactors.mockResolvedValue({ data: { all: [], totp: [{ id: "f9" }] }, error: null });
    render(<MfaPanel next="/admin" email="a@example.test" />);
    expect(await screen.findByText(t.mfaLostBody)).toBeInTheDocument();
  });
});
