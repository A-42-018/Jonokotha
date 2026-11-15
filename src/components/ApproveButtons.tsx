"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dict } from "@/lib/i18n";
import { useLang } from "@/components/ui/useLang";
import type { Status } from "@/lib/types";

type Action = "acknowledge" | "refer";
type Toast = { ok: boolean; msg: string };

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic";

export default function ApproveButtons({ cref, status }: { cref: string; status: Status }) {
  const t = dict[useLang()];
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const canAck = status === "received";
  const canRefer = status === "received" || status === "acknowledged";

  function ask(a: Action) {
    setAction(a);
    dialog.current?.showModal();
  }
  function close() {
    if (!busy) dialog.current?.close();
  }

  async function confirm() {
    if (!action) return;
    setBusy(true);
    let res: Toast;
    try {
      const r = await fetch(`/api/cases/${cref}/approve`, { method: "POST", body: JSON.stringify({ action }), signal: AbortSignal.timeout(15000) });
      if (r.ok) res = { ok: true, msg: action === "refer" ? t.ofToastRefer : t.ofToastAck };
      else res = { ok: false, msg: r.status === 401 || r.status === 403 ? t.ofToastForbidden : t.ofToastFail };
    } catch {
      res = { ok: false, msg: t.ofToastFail };
    }
    setBusy(false);
    dialog.current?.close();
    setToast(res);
    if (res.ok) router.refresh();
  }

  const btn = `inline-flex min-h-11 items-center justify-center rounded-xl px-5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
  const title = action === "refer" ? t.ofConfirmReferTitle : t.ofConfirmAckTitle;
  const body = action === "refer" ? t.ofConfirmReferBody : t.ofConfirmAckBody;

  return (
    <>
      {canRefer ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" disabled={!canAck} onClick={() => ask("acknowledge")} className={`${btn} bg-civic`}>{t.approveAck}</button>
          <button type="button" onClick={() => ask("refer")} className={`${btn} bg-leaf`}>{t.approveRefer}</button>
        </div>
      ) : (
        <p className="text-sm text-slate-600"><span aria-hidden>✓ </span>{t.ofDone}</p>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="ap-title"
        aria-describedby="ap-body"
        onClick={(e) => { if (e.target === dialog.current) close(); }}
        onCancel={(e) => { if (busy) e.preventDefault(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="space-y-3 p-5">
          <h2 id="ap-title" className="text-xl font-semibold text-civic">{title}</h2>
          <p id="ap-body" className="text-slate-600">{body}</p>
          <p className="text-xs text-amber-800">{t.humanOnly}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} disabled={busy} className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-5 font-medium disabled:opacity-50 ${focus}`}>{t.ofCancel}</button>
            <button type="button" onClick={confirm} disabled={busy} className={`${btn} bg-civic`}>{busy ? t.ofWorking : t.ofConfirmYes}</button>
          </div>
        </div>
      </dialog>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center">
        {toast && (
          <div role={toast.ok ? "status" : "alert"} className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-lg ${toast.ok ? "bg-leaf" : "bg-red-700"}`}>
            <span aria-hidden>{toast.ok ? "✓" : "⚠"}</span>
            <span>{toast.msg}</span>
            <button type="button" onClick={() => setToast(null)} aria-label={t.ofToastClose} className={`-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg ${focus}`}><span aria-hidden>✕</span></button>
          </div>
        )}
      </div>
    </>
  );
}
