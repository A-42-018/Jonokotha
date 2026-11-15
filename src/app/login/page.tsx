import LoginForm from "@/components/LoginForm";
import SessionExpired from "@/components/ui/SessionExpired";
import { dict, getLang } from "@/lib/i18n";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const lang = await getLang();
  const expired = (await searchParams).expired === "1";
  return (
    <>
      {expired && <SessionExpired t={dict[lang]} />}
      <LoginForm />
    </>
  );
}
