"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Office pages get a wide workspace; everything else keeps the narrow reading column. */
export default function MainShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const wide = path === "/office" || path.startsWith("/office/");
  return <main className={`mx-auto w-full px-4 py-6 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>;
}
