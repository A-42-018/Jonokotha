import type { ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import NoAccess from "@/components/ui/NoAccess";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { featureStatus, type FeatureKey } from "@/lib/capability";
import { guardAdmin } from "@/lib/guard";
import { dict, getLang, type Dict } from "@/lib/i18n";

/** Shared frame of the F5.7 admin pages: admin guard, no-access screen, title and lead. */
export async function adminPage(path: string, title: (t: Dict) => string, lead: ((t: Dict) => string) | null, body: (t: Dict) => ReactNode) {
  const t = dict[await getLang()];
  const { denied } = await guardAdmin(path);
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next={path} />;
  return <AdminShell t={t} title={title(t)} lead={lead?.(t)} current={path}>{body(t)}</AdminShell>;
}

/** A panel for a feature the server does not offer yet: text only, no control. Hidden if the feature is ever marked live. */
export function planned(key: FeatureKey, title: string, body: string, children?: ReactNode) {
  if (featureStatus(key) !== "planned") return null;
  return <PlannedPanel title={title} body={body}>{children}</PlannedPanel>;
}
