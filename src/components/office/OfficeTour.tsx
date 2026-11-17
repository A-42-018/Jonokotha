"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { OFFICE_TOUR_KEY, OFFICE_TOUR_STEPS } from "@/lib/pilot";

const STEPS = [["otT1", "otB1"], ["otT2", "otB2"], ["otT3", "otB3"], ["otT4", "otB4"], ["otT5", "otB5"]] as const;

/**
 * First-run tour for office staff (F6.1): five steps, shown once per device after a staff guard passed, and again on demand from /office/help.
 * "Done" is kept on this device only (no endpoint for it yet); skipping counts as done so the tour never nags.
 */
export function OfficeTourDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const last = i === OFFICE_TOUR_STEPS - 1;
  const [title, body] = STEPS[i];
  const close = () => { setI(0); onClose(); };
  return (
    <Dialog open={open} onClose={close} title={t[title]} description={t[body]}
      actions={<>
        {i > 0 && <Button variant="secondary" onClick={() => setI(i - 1)}>{t.otBack}</Button>}
        {!last && <Button variant="ghost" onClick={close}>{t.otSkip}</Button>}
        {last ? <Button onClick={close}>{t.otDone}</Button> : <Button onClick={() => setI(i + 1)}>{t.otNext}</Button>}
      </>}>
      <p className="text-sm text-muted" aria-live="polite">{t.otStep.replace("{n}", String(i + 1)).replace("{total}", String(OFFICE_TOUR_STEPS))}</p>
    </Dialog>
  );
}

/** Opens by itself the first time; `replay` (from the help page) opens it again. */
export default function OfficeTour() {
  const [done, setDone] = useLocalValue(OFFICE_TOUR_KEY, false);
  return <OfficeTourDialog open={!done} onClose={() => setDone(true)} />;
}

export function ReplayTour() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{t.ohTourRestart}</Button>
      <OfficeTourDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
