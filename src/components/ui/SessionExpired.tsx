import State from "./State";
import type { Dict } from "@/lib/i18n";

/** Shown above the sign-in form when a protected page sent the user to /login?expired=1. */
export default function SessionExpired({ t }: { t: Dict }) {
  return <State kind="expired" as="h2" title={t.stExpiredTitle} body={t.stExpiredBody} compact live="polite" />;
}
