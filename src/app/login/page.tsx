import LoginForm from "@/components/LoginForm";
import SessionExpired from "@/components/ui/SessionExpired";
import State from "@/components/ui/State";
import { safeNext } from "@/lib/guard";
import { dict, getLang } from "@/lib/i18n";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const lang = await getLang();
  const t = dict[lang];
  const sp = await searchParams;
  return (
    <>
      {sp.expired === "1" && <SessionExpired t={t} />}
      {sp.need === "1" && <State kind="expired" as="h2" title={t.stSignInNeededTitle} body={t.stSignInNeededBody} compact live="polite" />}
      <LoginForm next={safeNext(sp.next)} />
    </>
  );
}
