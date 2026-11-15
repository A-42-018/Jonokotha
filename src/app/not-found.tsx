import Link from "next/link";
import State, { btnPrimary } from "@/components/ui/State";
import { dict, getLang } from "@/lib/i18n";

export default async function NotFound() {
  const t = dict[await getLang()];
  return (
    <State kind="notFound" title={t.stNotFoundTitle} body={t.stNotFoundBody}>
      <Link href="/" className={btnPrimary}>{t.stGoHome}</Link>
    </State>
  );
}
