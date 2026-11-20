import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
let handler: (() => void) | null = null;
const removeChannel = vi.fn();
const subscribe = vi.fn(() => "channel-handle");
const on = vi.fn((_t: string, _f: unknown, cb: () => void) => { handler = cb; return { subscribe }; });
const channel = vi.fn(() => ({ on }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({ channel, removeChannel }) }));

import OfficeLive, { REFRESH_DELAY_MS } from "@/components/office/OfficeLive";

beforeEach(() => { vi.useFakeTimers(); refresh.mockReset(); removeChannel.mockReset(); handler = null; });
afterEach(() => { vi.useRealTimers(); });

describe("OfficeLive", () => {
  it("listens to changes on issues only and renders nothing", () => {
    const { container } = render(<OfficeLive />);
    expect(container).toBeEmptyDOMElement();
    expect(channel).toHaveBeenCalledWith("office-issues");
    expect(on.mock.calls.at(-1)?.[1]).toEqual({ event: "*", schema: "public", table: "issues" });
    expect(subscribe).toHaveBeenCalled();
  });

  it("refreshes once after a burst of changes", () => {
    render(<OfficeLive />);
    act(() => { handler!(); handler!(); handler!(); });
    expect(refresh).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(REFRESH_DELAY_MS); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("leaves the channel and drops a pending refresh on unmount", () => {
    const { unmount } = render(<OfficeLive />);
    act(() => { handler!(); });
    unmount();
    expect(removeChannel).toHaveBeenCalledWith("channel-handle");
    act(() => { vi.advanceTimersByTime(REFRESH_DELAY_MS * 2); });
    expect(refresh).not.toHaveBeenCalled();
  });
});
