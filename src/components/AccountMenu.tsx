"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Labels = { account: string; signIn: string; signOut: string; signingOut: string; staff: string; admin: string; citizen: string };

export default function AccountMenu({ email, role, labels }: { email: string | null; role: "citizen" | "staff" | "admin" | null; labels: Labels }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!email) {
    return (
      <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg border-2 border-civic bg-white px-3 font-medium text-civic hover:bg-civic/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">
        {labels.signIn}
      </Link>
    );
  }

  async function signOut() {
    setBusy(true);
    // Loaded on demand: the Supabase client is ~70 KB and only signing out needs it here.
    const { supabaseBrowser } = await import("@/lib/supabase/client");
    await supabaseBrowser().auth.signOut();
    setBusy(false);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${labels.account}: ${email}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic"
      >
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-civic text-sm font-semibold uppercase text-white">{email[0]}</span>
        <span className="hidden max-w-40 truncate sm:inline">{email}</span>
      </button>
      {open && (
        <div role="menu" className="absolute end-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="truncate text-sm text-slate-600">{email}</p>
          <p className="mt-1 inline-block rounded-full bg-teal/15 px-2 py-0.5 text-xs text-teal-strong">{role === "admin" ? labels.admin : role === "staff" ? labels.staff : labels.citizen}</p>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={signOut}
            className="mt-3 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-start font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-civic"
          >
            {busy ? labels.signingOut : labels.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
