import { notFound } from "next/navigation";
import OfficeActionsDemo from "@/components/office/OfficeActionsDemo";
import { dict, getLang } from "@/lib/i18n";
import type { AuditEntry } from "@/lib/office-actions";

const INITIAL: AuditEntry[] = [
  { id: "d0", actor: null, action: "received", at: "2026-11-14T06:10:00.000Z" },
  { id: "d1", actor: "Rahim Uddin", action: "request_info", at: "2026-11-15T04:30:00.000Z", note: "Asked for the nearest landmark and a photo of the pothole.\nNo reply yet; a very long unbroken token to test wrapping: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
];

/** Review-only page (not in production): staff action dialogs and the audit list against demo data. */
export default async function DevOfficeActions() {
  if (process.env.NODE_ENV === "production") notFound();
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.oaDevTitle} (demo)</h1>
      <p className="text-muted">{t.oaDevIntro}</p>
      <OfficeActionsDemo initial={INITIAL} />
    </div>
  );
}
