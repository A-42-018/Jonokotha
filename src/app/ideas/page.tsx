import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import ComingSoon from "@/components/ui/ComingSoon";
import { dict, getLang } from "@/lib/i18n";

export default async function Ideas() {
  const t = dict[await getLang()];
  return (
    <ComingSoon art="spot-idea" soonLabel={t.comingSoon} title={t.ideasSoonTitle} body={t.ideasSoonBody}>
      <Link href="/" className={buttonClass()}>{t.soonBackHome}</Link>
    </ComingSoon>
  );
}
