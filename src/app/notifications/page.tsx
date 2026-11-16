import NotificationList from "@/components/citizen/NotificationList";
import { dict, getLang } from "@/lib/i18n";
import { SAMPLE_NOTICES } from "@/lib/sample";

export default async function Notifications() {
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.ntTitle}</h1>
      <p className="text-muted">{t.ntLead}</p>
      <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.ntSampleBanner}</p>
      <NotificationList notices={SAMPLE_NOTICES} />
    </div>
  );
}
