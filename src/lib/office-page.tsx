import type { ReactNode } from "react";
import OfficeTour from "@/components/office/OfficeTour";
import NoAccess from "@/components/ui/NoAccess";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { guardStaff } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

/** Shared frame of the F5.4 office pages: staff guard, no-access screen, title and lead. `body` gets the area the staff member works in. */
export async function officePage(path: string, title: (t: ReturnType<typeof tOf>) => string, lead: ((t: ReturnType<typeof tOf>) => string) | null, body: (constituency: string) => ReactNode) {
  const t = tOf(await getLang());
  const { denied } = await guardStaff(path);
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next={path} />;
  const constituency = (await getConstituencyId()) ?? DEMO_CONSTITUENCY.id;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{title(t)}</h1>
      {lead && <p className="text-muted">{lead(t)}</p>}
      {body(constituency)}
      <OfficeTour />
    </div>
  );
}
const tOf = (l: keyof typeof dict) => dict[l];
