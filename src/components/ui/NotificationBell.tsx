"use client";
import Link from "next/link";
import { cx, focusRing } from "./cx";
import { BellIcon } from "./NavIcons";
import { useT } from "./useT";

/**
 * Bell: a plain link to the notification centre (live since F.1). It shows no unread count in the header yet,
 * because the count needs an authenticated call on every page; the centre itself lists and marks items.
 */
export default function NotificationBell() {
  const t = useT();
  return (
    <Link href="/notifications" aria-label={t.navBell} className={cx("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-civic hover:bg-slate-100", focusRing)}>
      <BellIcon />
    </Link>
  );
}
