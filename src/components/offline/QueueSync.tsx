"use client";
import { useEffect, useRef } from "react";
import { fillNum } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { flushNow, readQueue } from "./queue-store";

/** Invisible: when the phone comes back online (or the app opens with reports waiting), sends the saved reports. */
export default function QueueSync() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const latest = useRef({ t, lang, toast });
  useEffect(() => { latest.current = { t, lang, toast }; });

  useEffect(() => {
    async function run() {
      if (!navigator.onLine || !readQueue().some((q) => q.state === "queued")) return;
      const { sent } = await flushNow();
      const { t: tt, lang: l, toast: show } = latest.current;
      for (const s of sent) show("success", fillNum(tt.qSentToast, { ref: s.ref }, l));
    }
    void run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, []);
  return null;
}
