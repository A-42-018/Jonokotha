import Link from "next/link";
import State, { btnPrimary } from "./State";
import type { Dict } from "@/lib/i18n";

export default function NoAccess({ t }: { t: Dict }) {
  return (
    <State kind="noAccess" title={t.stNoAccessTitle} body={t.stNoAccessBody}>
      <Link href="/" className={btnPrimary}>{t.stGoHome}</Link>
    </State>
  );
}
