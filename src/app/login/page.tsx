import LoginForm from "@/components/LoginForm";
import { getLang } from "@/lib/i18n";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  return <LoginForm bn={(await getLang()) === "bn"} failed={sp.error === "1"} />;
}
