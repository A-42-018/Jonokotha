"use client";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import Button from "@/components/ui/Button";
import { demoOnBrowser, setDemoCookie } from "@/lib/demo-mode";

const subscribe = (cb: () => void) => { window.addEventListener("jk-demo", cb); return () => window.removeEventListener("jk-demo", cb); };

/** Starts or stops the simulated demo mode (a cookie) and reloads the page data so every screen picks it up. */
export default function DemoToggle({ labels, serverOn }: { labels: { start: string; stop: string; on: string; off: string }; serverOn: boolean }) {
  const router = useRouter();
  const on = useSyncExternalStore(subscribe, demoOnBrowser, () => serverOn);
  const flip = (next: boolean) => { setDemoCookie(next); window.dispatchEvent(new Event("jk-demo")); router.refresh(); };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg" variant={on ? "secondary" : "primary"} onClick={() => flip(!on)}>{on ? labels.stop : labels.start}</Button>
      <span role="status" className="text-sm text-muted">{on ? labels.on : labels.off}</span>
    </div>
  );
}
