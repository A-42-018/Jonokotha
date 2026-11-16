import Link from "next/link";
import type { Dict } from "@/lib/i18n";

/** The quiet, always-there line on report, ask and help pages. Not a banner: small text with the number as a tap-to-call link. */
export default function EmergencyNote({ t, withLink = true }: { t: Dict; withLink?: boolean }) {
  return (
    <p className="text-sm text-muted" data-testid="emergency-note">
      <a href="tel:999" className="font-medium text-danger underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">{t.emNote}</a>
      {withLink && <> <Link href="/help#emergency" className="inline-flex min-h-11 items-center underline underline-offset-2">{t.emNoteMore}</Link></>}
    </p>
  );
}
