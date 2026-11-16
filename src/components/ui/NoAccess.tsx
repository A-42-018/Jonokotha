import Link from "next/link";
import State, { btnPrimary } from "./State";
import SwitchAccount from "./SwitchAccount";
import type { Dict } from "@/lib/i18n";
import type { Role } from "@/lib/supabase/server";

export function roleLabel(t: Dict, role: Role) {
  return role === "admin" ? t.roleAdmin : role === "staff" ? t.staffRole : t.roleCitizen;
}

/** Signed in, wrong role. Says who is signed in and offers a way to switch accounts. */
export default function NoAccess({ t, email, role, next = "/office" }: { t: Dict; email?: string; role?: Role; next?: string }) {
  return (
    <State kind="noAccess" title={t.stNoAccessTitle} body={t.stNoAccessBody}>
      {email && role && (
        <p className="text-sm text-muted sm:basis-full">
          {t.naSignedInAs} <span className="break-all font-medium text-foreground">{email}</span>. {t.naRoleLine} <span className="font-medium text-foreground">{roleLabel(t, role)}</span>
        </p>
      )}
      <Link href="/" className={btnPrimary}>{t.stGoHome}</Link>
      {email && <SwitchAccount next={next} />}
    </State>
  );
}
