"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cx } from "./cx";
import { tabBarHidden } from "./nav";

/**
 * Page container. Browsing and workspace pages use the full desktop width (capped at 90rem, matching the header, so a 1920px screen keeps readable line lengths and one left edge); forms and reading pages keep a narrow column.
 * On phones it reserves room for the fixed bottom tab bar (64px bar + raised button + safe area).
 */
export default function MainShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const path = usePathname();
  // Workspace and browsing pages use the full desktop width; forms and reading pages keep a centred narrow column.
  const wide = path === "/" || ["/office", "/admin", "/area", "/ideas"].some((p) => path === p || path.startsWith(`${p}/`)) && !path.startsWith("/ideas/new");
  const bar = !tabBarHidden(path);
  return (
    <>
      <main
        id="main"
        className={cx(
          "mx-auto w-full px-4 pt-6 sm:px-6",
          wide ? "max-w-[90rem] lg:px-8" : "max-w-3xl",
          footer || !bar ? "pb-6" : "pb-[calc(6rem+env(safe-area-inset-bottom))] xl:pb-6",
        )}
      >
        {children}
      </main>
      {/* The footer is full width, so it sits after <main>, not inside it; on phones a green spacer under it clears the fixed bottom tab bar. */}
      {footer && (
        <div className="mt-auto">
          {footer}
          {bar && <div aria-hidden className="h-[calc(5rem+env(safe-area-inset-bottom))] bg-[#092f25] xl:hidden print:hidden" />}
        </div>
      )}
    </>
  );
}
