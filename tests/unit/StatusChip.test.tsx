import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusChip from "@/components/ui/StatusChip";
import { dict } from "@/lib/i18n";
import type { Status } from "@/lib/types";

const ALL: Status[] = ["received", "acknowledged", "referred", "resolved"];

describe("StatusChip", () => {
  it.each(ALL)("shows the label for %s in both languages", (status) => {
    for (const lang of ["bn", "en"] as const) {
      const label = dict[lang].statuses[status];
      const { unmount } = render(<StatusChip status={status} label={label} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("never relies on colour alone: each status has a hidden icon plus text", () => {
    const icons = new Set<string>();
    for (const status of ALL) {
      const { container, unmount } = render(<StatusChip status={status} label={status} />);
      const icon = container.querySelector("[aria-hidden]");
      expect(icon?.textContent).toBeTruthy();
      icons.add(icon!.textContent!);
      unmount();
    }
    expect(icons.size).toBe(ALL.length);
  });
});
