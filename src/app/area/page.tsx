import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import ComingSoon from "@/components/ui/ComingSoon";
import { dict, getLang } from "@/lib/i18n";

export default async function Area() {
  const t = dict[await getLang()];
  return (
    <ComingSoon art="spot-find-mp" soonLabel={t.comingSoon} title={t.areaSoonTitle} body={t.areaSoonBody}>
      <Link href="/report" className={buttonClass()}>{t.reportCta}</Link>
      <Link href="/" className={buttonClass({ variant: "secondary" })}>{t.soonBackHome}</Link>
    </ComingSoon>
  );
}
