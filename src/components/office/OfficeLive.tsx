"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Live office queue (Supabase Realtime, migration 0092). Subscribes to changes on `issues` as the signed-in staff member, so row-level
 * security decides what they hear about. A change only triggers a debounced refresh of the page's server data; the payload is ignored.
 * Renders nothing. If Realtime is not enabled or the connection drops, the page simply keeps working as before (manual refresh).
 */
export const REFRESH_DELAY_MS = 1500;

export default function OfficeLive() {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sb = supabaseBrowser();
    const ch = sb.channel("office-issues").on("postgres_changes", { event: "*", schema: "public", table: "issues" }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
    }).subscribe();
    return () => { clearTimeout(timer); void sb.removeChannel(ch); };
  }, [router]);
  return null;
}
