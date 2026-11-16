"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { useLang } from "@/components/ui/useLang";
import { fillNum } from "@/lib/i18n";
import { canDo, NOTE_MAX, NOTE_MIN, OFFICE_ACTIONS, submitToApproveRoute, validateNote, type OfficeAction, type SubmitAction } from "@/lib/office-actions";
import type { Status } from "@/lib/types";

const LABEL = { acknowledge: "oaAcknowledge", request_info: "oaRequestInfo", refer: "oaRefer", resolve: "oaResolve" } as const;
const TITLE = { acknowledge: "oaTitleAcknowledge", request_info: "oaTitleRequestInfo", refer: "oaTitleRefer", resolve: "oaTitleResolve" } as const;
const BODY = { acknowledge: "oaBodyAcknowledge", request_info: "oaBodyRequestInfo", refer: "oaBodyRefer", resolve: "oaBodyResolve" } as const;
const CONFIRM = { acknowledge: "oaConfirmAcknowledge", request_info: "oaConfirmRequestInfo", refer: "oaConfirmRefer", resolve: "oaConfirmResolve" } as const;
const TOAST = { acknowledge: "oaToastAcknowledge", request_info: "oaToastRequestInfo", refer: "oaToastRefer", resolve: "oaToastResolve" } as const;
const VARIANT = { acknowledge: "primary", request_info: "secondary", refer: "success", resolve: "success" } as const;

/**
 * Staff action buttons and their note dialogs. Staff only: render it inside the office area.
 * `enabled` limits which actions are offered; `submit` does the save (default: the existing approve route,
 * which supports acknowledge and refer only and does not store the note yet).
 */
export default function OfficeActions({ cref, status, enabled = OFFICE_ACTIONS, submit, onDone }: {
  cref: string;
  status: Status;
  enabled?: readonly OfficeAction[];
  submit?: SubmitAction;
  /** Called after a successful save. Default: refresh the server data. */
  onDone?: (action: OfficeAction, note: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const toast = useToast();
  const formId = useId();
  const [action, setAction] = useState<OfficeAction | null>(null);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failMsg, setFailMsg] = useState<string | null>(null);

  const offered = OFFICE_ACTIONS.filter((a) => enabled.includes(a) && canDo(a, status));
  const err = validateNote(note);
  const msg = (e: NonNullable<typeof err>) =>
    fillNum({ empty: t.oaNoteEmpty, short: t.oaNoteShort, long: t.oaNoteLong }[e], { min: NOTE_MIN, max: NOTE_MAX }, lang);

  function open(a: OfficeAction) { setNote(""); setTouched(false); setFailMsg(null); setAction(a); }
  function close() { if (!busy) setAction(null); }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;
    setTouched(true);
    if (err) { document.getElementById(`${formId}-note`)?.focus(); return; }
    setBusy(true);
    setFailMsg(null);
    const result = await (submit ?? submitToApproveRoute(cref))(action, note.trim());
    setBusy(false);
    if (result === "ok") {
      const done = action;
      setAction(null);
      toast("success", t[TOAST[done]]);
      if (onDone) onDone(done, note.trim()); else router.refresh();
    } else {
      // Keep the dialog open and the note intact so nothing the staff member wrote is lost.
      // The toast sits under the modal backdrop, so the message is also shown inside the dialog.
      setFailMsg(result === "forbidden" ? t.ofToastForbidden : t.ofToastFail);
    }
  }

  return (
    <>
      {offered.length ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {offered.map((a) => (
            <Button key={a} variant={VARIANT[a]} onClick={() => open(a)}>{t[LABEL[a]]}</Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted"><span aria-hidden>✓ </span>{t.oaNoActions}</p>
      )}

      <Dialog
        open={action !== null}
        onClose={close}
        busy={busy}
        title={action ? t[TITLE[action]] : ""}
        description={action ? t[BODY[action]] : undefined}
        actions={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>{t.ofCancel}</Button>
            <Button type="submit" form={formId} loading={busy}>{busy ? t.ofWorking : action ? t[CONFIRM[action]] : ""}</Button>
          </>
        }
      >
        {action && (
          <form id={formId} onSubmit={confirm} noValidate className="space-y-1">
            <Textarea
              id={`${formId}-note`}
              label={t.oaNote}
              hint={fillNum(t.oaNoteHint, { min: NOTE_MIN, max: NOTE_MAX }, lang)}
              error={touched && err ? msg(err) : undefined}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => setTouched(true)}
              disabled={busy}
              required
              autoFocus
              rows={4}
            />
            {failMsg && <p role="alert" className="flex items-start gap-1 text-sm font-medium text-danger"><span aria-hidden>⚠</span><span>{failMsg}</span></p>}
            <p className="text-end text-sm text-muted" aria-hidden>{fillNum(t.oaNoteCount, { n: note.length, max: NOTE_MAX }, lang)}</p>
          </form>
        )}
      </Dialog>
    </>
  );
}
