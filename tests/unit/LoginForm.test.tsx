import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "@/components/LoginForm";
import { dict } from "@/lib/i18n";

const push = vi.fn();
const refresh = vi.fn();
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/login" }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({ auth: { signInWithOtp, verifyOtp } }) }));

const t = dict.bn;

beforeEach(() => {
  push.mockReset(); refresh.mockReset(); signInWithOtp.mockReset(); verifyOtp.mockReset();
});

describe("LoginForm", () => {
  it("rejects an email without @ and does not call the API", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(t.loginEmail), "nope");
    await user.click(screen.getByRole("button", { name: t.loginSend }));
    expect(await screen.findByText(t.loginEmailBad)).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends a code, then verifies it and goes to the default page", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(t.loginEmail), "a@b.com");
    await user.click(screen.getByRole("button", { name: t.loginSend }));
    await user.type(await screen.findByLabelText(t.loginCode), "123456");
    await user.click(screen.getByRole("button", { name: t.loginVerify }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/report"));
    expect(verifyOtp).toHaveBeenCalledWith({ email: "a@b.com", token: "123456", type: "email" });
  });

  it("returns to the page given in `next` after sign-in", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm next="/office" />);
    await user.type(screen.getByLabelText(t.loginEmail), "a@b.com");
    await user.click(screen.getByRole("button", { name: t.loginSend }));
    await user.type(await screen.findByLabelText(t.loginCode), "654321");
    await user.click(screen.getByRole("button", { name: t.loginVerify }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/office"));
  });

  it("shows an error for a wrong code and stays on the page", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: new Error("bad") });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(t.loginEmail), "a@b.com");
    await user.click(screen.getByRole("button", { name: t.loginSend }));
    await user.type(await screen.findByLabelText(t.loginCode), "000000");
    await user.click(screen.getByRole("button", { name: t.loginVerify }));
    expect(await screen.findByText(t.loginVerifyFail)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
