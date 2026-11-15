"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import type { Status } from "@/lib/types";

type Action = "acknowledge" | "refer";

export default function ApproveButtons({ cref, status }: { cref: string; status: Status }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  const canAck = status === "received";
  const canRefer = status === "received" || status === "acknowledged";

  async function confirm() {
    if (!action) return;
    setBusy(true);
    let ok = false;
    let msg: string = t.ofToastFail;
    try {
      const r = await fetch(`/api/cases/${cref}/approve`, { method: "POST", body: JSON.stringify({ action }), signal: AbortSignal.timeout(15000) });
      if (r.ok) { ok = true; msg = action === "refer" ? t.ofToastRefer : t.ofToastAck; }
      else if (r.status === 401 || r.status === 403) msg = t.ofToastForbidden;
    } catch { /* keep the generic failure message */ }
    setBusy(false);
    setAction(null);
    toast(ok ? "success" : "error", msg);
    if (ok) router.refresh();
  }

  return (
    <>
      {canRefer ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button disabled={!canAck} onClick={() => setAction("acknowledge")}>{t.approveAck}</Button>
          <Button variant="success" onClick={() => setAction("refer")}>{t.approveRefer}</Button>
        </div>
      ) : (
        <p className="text-sm text-muted"><span aria-hidden>✓ </span>{t.ofDone}</p>
      )}

      <Dialog
        open={action !== null}
        onClose={() => setAction(null)}
        busy={busy}
        title={action === "refer" ? t.ofConfirmReferTitle : t.ofConfirmAckTitle}
        description={action === "refer" ? t.ofConfirmReferBody : t.ofConfirmAckBody}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAction(null)} disabled={busy}>{t.ofCancel}</Button>
            <Button onClick={confirm} loading={busy}>{busy ? t.ofWorking : t.ofConfirmYes}</Button>
          </>
        }
      >
        <p className="text-xs text-amber-900">{t.humanOnly}</p>
      </Dialog>
    </>
  );
}
