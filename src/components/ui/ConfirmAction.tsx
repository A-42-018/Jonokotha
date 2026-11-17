"use client";
import { useState } from "react";
import Button, { type ButtonVariant } from "./Button";
import Dialog from "./Dialog";
import { useT } from "./useT";

/** A button that asks first. For outward actions (publish, open, close) the masterplan keeps a confirm step. */
export default function ConfirmAction({ label, title, body, onConfirm, loading = false, disabled = false, variant = "primary", confirmLabel }: {
  label: string; title?: string; body: string; onConfirm: () => Promise<unknown> | void; loading?: boolean; disabled?: boolean; variant?: ButtonVariant; confirmLabel?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const run = async () => { try { await onConfirm(); } finally { setOpen(false); } };
  return (
    <>
      <Button variant={variant} disabled={disabled} onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title ?? label} description={body} busy={loading}
        actions={<><Button variant="ghost" disabled={loading} onClick={() => setOpen(false)}>{t.cpCancel}</Button><Button variant={variant === "danger" ? "danger" : "primary"} loading={loading} onClick={() => void run()}>{confirmLabel ?? label}</Button></>} />
    </>
  );
}
