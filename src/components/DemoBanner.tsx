"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setDemoCookie } from "@/lib/demo-mode";

/** Shown on every page while simulated demo mode is on, so nobody mistakes example data for real reports. */
export default function DemoBanner({ text, gallery, exit }: { text: string; gallery: string; exit: string }) {
  const router = useRouter();
  return (
    <div role="region" aria-label={text} className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber px-3 py-2 text-center text-sm font-medium text-[#3b2a00]">
      <span>{text}</span>
      <span className="flex items-center gap-3">
        <Link href="/demo" className="inline-flex min-h-11 items-center underline">{gallery}</Link>
        <button type="button" className="inline-flex min-h-11 items-center underline" onClick={() => { setDemoCookie(false); router.push("/demo"); router.refresh(); }}>{exit}</button>
      </span>
    </div>
  );
}
