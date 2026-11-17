"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cx } from "./cx";
import { tabBarHidden } from "./nav";

/**
 * Page container. Browsing and workspace pages use the full desktop width (to 120rem, matching the header); forms and reading pages keep a narrow column.
 * On phones it reserves room for the fixed bottom tab bar (64px bar + raised button + safe area).
 */
export default function MainShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const path = usePathname();
  // Workspace and browsing pages use the full desktop width; forms and reading pages keep a centred narrow column.
  const wide = path === "/" || ["/office", "/admin", "/area", "/ideas"].some((p) => path === p || path.startsWith(`${p}/`)) && !path.startsWith("/ideas/new");
  return (
    <main
      id="main"
      className={cx(
        "mx-auto w-full px-4 pt-6 sm:px-6",
        wide ? "max-w-[120rem] lg:px-8" : "max-w-3xl",
        tabBarHidden(path) ? "pb-6" : "pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-6",
      )}
    >
      {children}
      {footer}
    </main>
  );
}
