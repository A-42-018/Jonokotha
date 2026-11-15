import ReportForm from "@/components/ReportForm";
import { dict, getLang } from "@/lib/i18n";

export default async function Report() {
  const lang = await getLang();
  return <ReportForm t={dict[lang]} lang={lang} />;
}
