import SettingsPanel from "@/components/me/SettingsPanel";
import { dict, getLang } from "@/lib/i18n";
import { safeStatusUrl } from "@/lib/notifications-api";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const t = dict[await getLang()];
  let email: string | null = null;
  let role: string | null = null;
  try { const cu = await currentUser(); email = cu.user?.email ?? null; role = cu.user ? cu.role : null; } catch { /* signed out */ }
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.stTitle}</h1>
      <SettingsPanel email={email} role={role} statusUrl={safeStatusUrl(process.env.NEXT_PUBLIC_STATUS_URL)} />
    </div>
  );
}
