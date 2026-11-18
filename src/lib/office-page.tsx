import type { ReactNode } from "react";
import OfficeTour from "@/components/office/OfficeTour";
import NoAccess from "@/components/ui/NoAccess";
import { OFFICE_PERMISSIONS } from "@/lib/auth";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { guardStaff } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

/** Shared frame of the F5.4 office pages: staff guard, no-access screen, title and lead. `body` gets the area the staff member works in (see `officeArea`). */
export async function officePage(path: string, title: (t: ReturnType<typeof tOf>) => string, lead: ((t: ReturnType<typeof tOf>) => string) | null, body: (constituency: string, can: { assign: boolean }) => ReactNode) {
  const t = tOf(await getLang());
  const { denied, actor } = await guardStaff(path);
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next={path} />;
  const constituency = officeArea(actor?.offices.map((o) => o.constituencyKey).filter(Boolean) ?? [], await getConstituencyId());
  // UI hint only: the database (office_can) stays the authority and refuses the rest.
  const assign = actor?.role === "admin" || !!actor?.offices.some((o) => o.constituencyKey === constituency && OFFICE_PERMISSIONS[o.officeRole].assign);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{title(t)}</h1>
      {lead && <p className="text-muted">{lead(t)}</p>}
      {body(constituency, { assign })}
      <OfficeTour />
    </div>
  );
}
const tOf = (l: keyof typeof dict) => dict[l];

/**
 * The area an office page works on: one of the account's own offices, never just the area a visitor picked.
 * The area cookie only chooses between several offices of the same account. Without an office (an administrator) the cookie or the sample area is used.
 */
export function officeArea(offices: string[], cookie: string | null): string {
  if (offices.length > 0) return cookie && offices.includes(cookie) ? cookie : offices[0];
  return cookie ?? DEMO_CONSTITUENCY.id;
}
