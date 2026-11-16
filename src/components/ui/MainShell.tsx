"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cx } from "./cx";
import { tabBarHidden } from "./nav";

/**
 * Page container. Office pages get a wide workspace; everything else keeps the narrow reading column.
 * On phones it reserves room for the fixed bottom tab bar (64px bar + raised button + safe area).
 */
export default function MainShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const wide = ["/office", "/admin"].some((p) => path === p || path.startsWith(`${p}/`));
  return (
    <main
      id="main"
      className={cx(
        "mx-auto w-full px-4 pt-6",
        wide ? "max-w-6xl" : "max-w-3xl",
        tabBarHidden(path) ? "pb-6" : "pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-6",
      )}
    >
      {children}
    </main>
  );
}
