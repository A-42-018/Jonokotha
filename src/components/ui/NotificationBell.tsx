"use client";
import { useState } from "react";
import Badge from "./Badge";
import { cx, focusRing } from "./cx";
import Dialog from "./Dialog";
import { BellIcon } from "./NavIcons";
import { useT } from "./useT";

/** Notification bell stub: opens a panel that says the feature is coming. No count until notifications exist. */
export default function NotificationBell() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t.navBell}
        onClick={() => setOpen(true)}
        className={cx("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-civic hover:bg-slate-100", focusRing)}
      >
        <BellIcon />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.navBell}>
        <Badge>{t.comingSoon}</Badge>
        <p className="font-medium">{t.navBellEmpty}</p>
        <p className="text-muted">{t.navBellSoon}</p>
      </Dialog>
    </>
  );
}
