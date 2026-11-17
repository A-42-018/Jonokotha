"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cx, ringOnDark } from "./cx";
import { BellIcon } from "./NavIcons";
import { useLang } from "./useLang";
import { useT } from "./useT";
import { fillNum, fmtNum } from "@/lib/format";
import { fetchUnreadCount, listenOwnNotices, POLL_MS, realtimeOn } from "@/lib/live";

/**
 * Bell: a link to the notification centre with the person's own unread count when signed in.
 * The count comes from Realtime on their own rows once the server has it on (B5.8); until then it is read again
 * every minute while the tab is visible. Plain fetch and state (no query client) keep the first-load JavaScript small.
 */
export default function NotificationBell({ userId = null }: { userId?: string | null }) {
  const t = useT();
  const lang = useLang();
  const [count, setCount] = useState<number | null>(null);
  const read = useCallback(() => { void fetchUnreadCount().then((n) => { if (n !== null) setCount(n); }); }, []);

  useEffect(() => {
    if (!userId) return;
    read();
    let timer: ReturnType<typeof setInterval> | undefined;
    const startPolling = () => { if (!timer) timer = setInterval(() => { if (document.visibilityState === "visible") read(); }, POLL_MS); };
    const stopPolling = () => { if (timer) { clearInterval(timer); timer = undefined; } };
    const onShow = () => { if (document.visibilityState === "visible") read(); };
    document.addEventListener("visibilitychange", onShow);
    let off: (() => void) | undefined;
    let gone = false;
    if (realtimeOn()) {
      void import("@/lib/supabase/client").then(({ supabaseBrowser }) => {
        if (gone) return;
        off = listenOwnNotices(supabaseBrowser() as never, userId, read, (live) => { if (live) stopPolling(); else startPolling(); });
      }).catch(startPolling);
    } else startPolling();
    return () => { gone = true; stopPolling(); off?.(); document.removeEventListener("visibilitychange", onShow); };
  }, [userId, read]);

  const unread = count ?? 0;
  const label = unread > 0 ? `${t.navBell}, ${fillNum(t.lvUnread, { n: unread }, lang)}` : t.navBell;
  return (
    <Link href="/notifications" aria-label={label} className={cx("relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white hover:bg-white/10", ringOnDark)}>
      <BellIcon />
      {unread > 0 && <span aria-hidden data-unread className="absolute end-0.5 top-0.5 min-w-5 rounded-full bg-danger px-1 text-center text-xs font-semibold leading-5 text-white">{unread > 99 ? `${fmtNum(99, lang)}+` : fmtNum(unread, lang)}</span>}
    </Link>
  );
}
