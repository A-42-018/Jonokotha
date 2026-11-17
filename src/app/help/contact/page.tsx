import SupportForm from "@/components/SupportForm";
import { dict, getLang } from "@/lib/i18n";
import { SUPPORT_EMAIL } from "@/lib/legal";

export default async function Contact() {
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.spTitle}</h1>
      <SupportForm supportEmail={SUPPORT_EMAIL} />
    </div>
  );
}
