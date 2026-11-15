import State from "@/components/ui/State";
import { dict, getLang } from "@/lib/i18n";

export default async function Offline() {
  const t = dict[await getLang()];
  return <State kind="offline" title={t.stOfflineTitle} body={t.stOfflineBody} />;
}
